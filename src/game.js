// Extrato do código principal movido de index.html para src/game.js
// Mantive a lógica original, modularizada levemente para facilitar manutenção.

// Componente A-Frame para objetos colecionáveis
AFRAME.registerComponent('collectible-object', {
    init: function () {
        console.log('Inicializando componente collectible-object para:', this.el.id);

        // Múltiplos eventos para garantir detecção
        const events = ['click', 'touchstart', 'mousedown'];

        events.forEach(eventType => {
            this.el.addEventListener(eventType, (event) => {
                event.stopPropagation();
                event.preventDefault();
                console.log(`Evento ${eventType} detectado no objeto:`, this.el.id);

                // Disparar evento customizado
                this.el.dispatchEvent(new CustomEvent('object-clicked', {
                    detail: { objectId: this.el.id, eventType: eventType }
                }));
            });
        });

        // Eventos do cursor A-Frame
        this.el.addEventListener('mouseenter', () => {
            console.log('Mouse enter no objeto:', this.el.id);
            document.body.style.cursor = 'pointer';

            // Mostrar cursor A-Frame quando sobre objeto coletável
            const cursor = document.getElementById('cursor');
            if (cursor && this.isCurrentCollectible()) {
                cursor.setAttribute('visible', true);
            }
        });

        this.el.addEventListener('mouseleave', () => {
            console.log('Mouse leave no objeto:', this.el.id);
            document.body.style.cursor = 'default';

            // Esconder cursor A-Frame
            const cursor = document.getElementById('cursor');
            if (cursor) {
                cursor.setAttribute('visible', false);
            }
        });

        // Evento específico do cursor A-Frame
        this.el.addEventListener('raycaster-intersected', () => {
            console.log('Raycaster intersected:', this.el.id);
        });

        this.el.addEventListener('raycaster-intersected-cleared', () => {
            console.log('Raycaster cleared:', this.el.id);
        });
    },

    isCurrentCollectible: function () {
        // Verificar se este é o objeto atual que pode ser coletado
        return window.currentObjectPlaced &&
            window.currentObjectIndex < window.objectsToPlace.length &&
            window.objectsToPlace[window.currentObjectIndex] === this.el.id;
    }
});

console.log('Script src/game.js carregado, aguardando DOM...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado - listener em src/game.js');
    const sceneEl = document.getElementById('ar-scene');
    const loadingScreen = document.getElementById('loading-screen');
    const enterButton = document.getElementById('enter-button');
    const loadingInfo = document.getElementById('loading-info');
    const progressBar = document.getElementById('progress-bar');
    const victoryScreen = document.getElementById('victory-screen');
    const reticle = document.getElementById('reticle');


    const collectibles = {
        'walkie-talkie': false,
        bike: false,
        compass: false,
        'baseball-bat': false,
        demogorgon: false,
        'will-mundo-invertido': false
    };
    let foundCollectibles = 0;
    const objectsToPlace = ['walkie-talkie', 'bike', 'compass', 'baseball-bat', 'demogorgon', 'will-mundo-invertido'];
    let currentObjectIndex = 0;
    let currentObjectPlaced = false;
    let gameInitialized = false; // Flag para controlar a inicialização do jogo

    // Tornar variáveis acessíveis globalmente para o componente A-Frame
    window.objectsToPlace = objectsToPlace;
    window.currentObjectIndex = currentObjectIndex;
    window.currentObjectPlaced = currentObjectPlaced;
    let canPlace = false; // Inicialmente false até chegar na localização
    let hitTestSource = null;
    let geolocationWatchId = null;
    let currentLocation = null;
    let locationUnlocked = [false, false, false, false, false, false, false]; // Controla se cada localização foi desbloqueada

    // Coordenadas dos objetos (latitude, longitude)
    // IMPORTANTE: A ordem deve corresponder exatamente à array objectsToPlace
    const objectLocations = [
        { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Walkie-Talkie' },
                { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Bicicleta' },
                { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Bússola' },
                { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Taco de Baseball' },
                { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Demogorgon' },
                { lat: -27.63979837778027, lng: -48.667736030079546, name: 'Will (Mundo Invertido)' }
    ];

    const PROXIMITY_RADIUS = 10; // 10 metros

    // Sistema de áudios do Dustin para cada missão
    const dustinAudios = {
        'walkie-talkie': 'assets/audio/dustin-missao-1-completa.mp3',
        'bike': 'assets/audio/dustin-missao-2-completa.mp3',
        'compass': 'assets/audio/dustin-missao-3-completa.mp3',
        'baseball-bat': 'assets/audio/dustin-missao-4-completa.mp3',
        'demogorgon': 'assets/audio/dustin-missao-5-completa.mp3',
        'will-mundo-invertido': 'assets/audio/dustin-missao-6-completa.mp3'
    };

    // Tornar disponível globalmente
    window.dustinAudios = dustinAudios;

    // Sistema de carregamento real de assets
    let totalAssets = 0;
    let loadedAssets = 0;
    let assetsLoaded = false;
    let preloadedAudios = {};

    function updateLoadingProgress() {
        console.log(`updateLoadingProgress: ${loadedAssets}/${totalAssets}`);

        if (totalAssets === 0) {
            console.warn('totalAssets é 0, não é possível calcular progresso');
            return;
        }

        const progress = Math.round((loadedAssets / totalAssets) * 100);

        if (progressBar) {
            progressBar.style.width = progress + '%';
            console.log(`Barra de progresso atualizada para ${progress}%`);
        } else {
            console.error('progressBar não encontrada!');
        }

        if (loadingInfo) {
            if (loadedAssets < totalAssets) {
                loadingInfo.innerText = `Carregando assets... ${loadedAssets}/${totalAssets} (${progress}%)`;
            } else if (!assetsLoaded) {
                assetsLoaded = true;
                loadingInfo.innerText = "Todos os assets carregados! Pronto para jogar offline.";

                const progressContainer = document.getElementById('progress-bar-container');
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }

                if (enterButton) {
                    enterButton.style.display = 'block';
                }

                console.log('Todos os assets carregados com sucesso!');
            }
        } else {
            console.error('loadingInfo não encontrada!');
        }
    }

    // Elementos da ligação
    const callScreen = document.getElementById('call-screen');
    const answerButton = document.getElementById('answer-button');
    const declineButton = document.getElementById('decline-button');
    const callTimer = document.getElementById('call-timer');
    const callStatus = document.getElementById('call-status');
    let dustinAudio = null;
    let callStartTime = null;
    let callTimerInterval = null;
    let vibrationInterval = null;
    let ringtonePlaying = false;
    // Handlers and fallback control for Dustin audio
    let dustinAudioEndedHandler = null;
    let dustinAudioErrorHandler = null;
    let callEndTimeout = null;
    let callAudioMonitorInterval = null;
    let callEndedFlag = false;

    let currentMissionAudio = 'walkie-talkie'; // Controla qual áudio tocar

    function showDustinCall(missionKey = 'walkie-talkie') {
        currentMissionAudio = missionKey;
        console.log('Mostrando ligação do Dustin para missão:', missionKey);

        // Esconder a UI do jogo e mostrar a tela de ligação
        document.getElementById('backpack-icon').style.display = 'none';
        document.getElementById('distance-meter').classList.remove('show');
        callScreen.classList.remove('hidden');

        // Iniciar vibração de ligação recebida
        startIncomingCallEffects();

        // Remover listeners anteriores para evitar duplicação
        answerButton.removeEventListener('click', answerCall);
        declineButton.removeEventListener('click', declineCall);

        // Configurar eventos dos botões com proteção contra duplicação
        answerButton.addEventListener('click', answerCall, { once: true });
        declineButton.addEventListener('click', declineCall, { once: true });
    }

    // Tornar função disponível globalmente
    window.showDustinCall = showDustinCall;

    function startIncomingCallEffects() {
        const vibrationPattern = [500, 300, 500, 1000];
        if (navigator.vibrate) {
            vibrationInterval = setInterval(() => {
                navigator.vibrate(vibrationPattern);
            }, 2000);
        }
        try {
            createRingtone();
        } catch (error) {
            console.log('Web Audio não suportado');
        }
    }

    function createRingtone() {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        function playTone(frequency, duration, delay = 0) {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + duration);
            }, delay);
        }
        function playRingtone() {
            if (!ringtonePlaying) return;
            playTone(800, 0.3, 0);
            playTone(600, 0.3, 400);
            setTimeout(playRingtone, 2000);
        }
        ringtonePlaying = true;
        playRingtone();
    }

    function stopIncomingCallEffects() {
        if (vibrationInterval) {
            clearInterval(vibrationInterval);
            vibrationInterval = null;
        }
        ringtonePlaying = false;
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    function answerCall() {
        stopIncomingCallEffects();
        if (navigator.vibrate) navigator.vibrate(100);

        callStatus.innerText = "Conectando...";
        document.getElementById('call-buttons').style.display = 'none';
        callTimer.style.display = 'block';
        callScreen.classList.add('call-active');
        answerButton.classList.remove('calling-animation');

        // Usar o áudio pré-carregado da missão atual
        if (preloadedAudios[currentMissionAudio] && preloadedAudios[currentMissionAudio].readyState >= 2) {
            dustinAudio = preloadedAudios[currentMissionAudio];
            console.log('Usando áudio pré-carregado para:', currentMissionAudio);
        } else {
            dustinAudio = new Audio(dustinAudios[currentMissionAudio]);
            dustinAudio.preload = 'auto';
            dustinAudio.volume = 0.8;
            console.log('Carregando áudio dinamicamente para:', currentMissionAudio);
        }

        callStatus.innerText = "Chamada em andamento...";
        callStartTime = Date.now();
        startCallTimer();

        // Remover listeners antigos se existirem
        if (dustinAudioEndedHandler && dustinAudio && typeof dustinAudio.removeEventListener === 'function') {
            try { dustinAudio.removeEventListener('ended', dustinAudioEndedHandler); } catch (e) {}
            dustinAudioEndedHandler = null;
        }
        if (dustinAudioErrorHandler && dustinAudio && typeof dustinAudio.removeEventListener === 'function') {
            try { dustinAudio.removeEventListener('error', dustinAudioErrorHandler); } catch (e) {}
            dustinAudioErrorHandler = null;
        }

        // Handler nomeado para garantir que podemos removê-lo depois
        dustinAudioEndedHandler = function () {
            if (callEndedFlag) return;
            callEndedFlag = true;
            // Limpar fallback e monitor
            if (callEndTimeout) { clearTimeout(callEndTimeout); callEndTimeout = null; }
            if (callAudioMonitorInterval) { clearInterval(callAudioMonitorInterval); callAudioMonitorInterval = null; }
            callStatus.innerText = "Chamada finalizada";
            // pequena folga antes de fechar para UX
            setTimeout(() => endCall(false), 1500);
        };

        dustinAudioErrorHandler = function () {
            callStatus.innerText = "Erro no áudio, finalizando...";
            setTimeout(() => endCall(false), 2000);
        };

        dustinAudio.addEventListener('ended', dustinAudioEndedHandler);
        dustinAudio.addEventListener('error', dustinAudioErrorHandler);

        // Fallback: se o evento 'ended' não disparar (arquivos trocados), fechamos após duração + buffer
        const scheduleFallbackEnd = () => {
            if (callEndTimeout) clearTimeout(callEndTimeout);
            const duration = (dustinAudio && !isNaN(dustinAudio.duration) && isFinite(dustinAudio.duration)) ? dustinAudio.duration : null;
            if (duration && duration > 0) {
                callEndTimeout = setTimeout(() => {
                    console.warn('Fallback: encerrando chamada após duração do áudio');
                    callStatus.innerText = "Chamada finalizada (fallback)";
                    endCall(false);
                }, (duration + 2) * 1000); // buffer de 2s
            } else {
                // Duração desconhecida: fallback seguro de 2 minutos
                callEndTimeout = setTimeout(() => {
                    console.warn('Fallback: encerrando chamada (timeout geral)');
                    callStatus.innerText = "Chamada finalizada (timeout)";
                    endCall(false);
                }, 120000);
            }
        };

        const playAudio = () => {
            dustinAudio.play().then(() => {
                // Reset flag
                callEndedFlag = false;
                scheduleFallbackEnd();

                // Iniciar monitor de polling para garantir detecção de fim mesmo quando 'ended' não disparar
                if (callAudioMonitorInterval) clearInterval(callAudioMonitorInterval);
                callAudioMonitorInterval = setInterval(() => {
                    try {
                        if (!dustinAudio) return;
                        // if audio reports ended or nearly reached duration
                        if (dustinAudio.ended || (dustinAudio.duration > 0 && (dustinAudio.currentTime >= (dustinAudio.duration - 0.5)))) {
                            if (!callEndedFlag) {
                                console.log('Monitor detectou fim do áudio (polling).');
                                callEndedFlag = true;
                                if (callEndTimeout) { clearTimeout(callEndTimeout); callEndTimeout = null; }
                                clearInterval(callAudioMonitorInterval);
                                callAudioMonitorInterval = null;
                                setTimeout(() => endCall(false), 500);
                            }
                        }
                    } catch (e) {
                        console.warn('Erro no monitor de áudio:', e);
                    }
                }, 500);
            }).catch(error => {
                console.error('Erro ao reproduzir áudio:', error);
                callStatus.innerText = "Áudio indisponível - continuando...";
                setTimeout(() => endCall(false), 3000);
            });
        };

        if (dustinAudio.readyState >= 2) playAudio();
        else dustinAudio.addEventListener('canplaythrough', playAudio, { once: true });
    }

    function startCallTimer() {
        callTimerInterval = setInterval(() => {
            if (!callStartTime) return;
            const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            callTimer.innerText = `${minutes}:${seconds}`;
        }, 1000);
    }

    function stopCallTimer() {
        if (callTimerInterval) {
            clearInterval(callTimerInterval);
            callTimerInterval = null;
        }
        callStartTime = null;
    }

    function declineCall() {
        stopIncomingCallEffects();
        if (navigator.vibrate) navigator.vibrate([100, 100, 100]);
        callStatus.innerText = "Chamada recusada";

        setTimeout(() => {
            endCall(true); // Passa um flag para indicar que foi recusada
        }, 1500);
    }

    function endCall(wasDeclined = false) {
        console.log('endCall() chamada');
        stopIncomingCallEffects();
        stopCallTimer();

        // Limpeza adequada do áudio
        if (dustinAudio) {
            dustinAudio.pause();
            dustinAudio.currentTime = 0;
            try {
                if (dustinAudioEndedHandler) dustinAudio.removeEventListener('ended', dustinAudioEndedHandler);
            } catch (e) {}
            try {
                if (dustinAudioErrorHandler) dustinAudio.removeEventListener('error', dustinAudioErrorHandler);
            } catch (e) {}
            dustinAudio = null;
        }

        // Limpar timeout de fallback se existente
        if (callEndTimeout) {
            clearTimeout(callEndTimeout);
            callEndTimeout = null;
        }

        dustinAudioEndedHandler = null;
        dustinAudioErrorHandler = null;
        // Limpar monitor de polling caso exista
        if (callAudioMonitorInterval) {
            clearInterval(callAudioMonitorInterval);
            callAudioMonitorInterval = null;
        }
        callEndedFlag = false;

        // Remover listeners dos botões para evitar vazamentos
        answerButton.removeEventListener('click', answerCall);
        declineButton.removeEventListener('click', declineCall);

        callScreen.classList.remove('call-active');
        callScreen.classList.add('hidden');

        // Resetar UI da ligação para a próxima vez
        callTimer.style.display = 'none';
        document.getElementById('call-buttons').style.display = 'flex';
        answerButton.classList.add('calling-animation');
        callStatus.innerText = "Chamada recebida...";

        // Mostrar UI do jogo novamente
        document.getElementById('backpack-icon').style.display = 'flex';
        document.getElementById('distance-meter').classList.add('show');

        // Continuar para o próximo objeto ou mostrar vitória
        if (currentMissionAudio === 'will-mundo-invertido') {
            setTimeout(showVictoryScreen, 2000);
        } else {
            prepareForNextObject();
        }
    }

    // Função de carregamento simples como fallback
    function startSimpleLoading() {
        console.log('Iniciando carregamento simples...');
        loadingInfo.innerText = "Carregando jogo...";

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            progressBar.style.width = progress + '%';
            loadingInfo.innerText = `Carregando... ${progress}%`;

            if (progress >= 100) {
                clearInterval(interval);
                assetsLoaded = true;
                loadingInfo.innerText = "Pronto para jogar!";
                document.getElementById('progress-bar-container').style.display = 'none';
                enterButton.style.display = 'block';
                console.log('Carregamento simples concluído');
            }
        }, 300);
    }

    // Função de carregamento de áudios real (dentro do escopo do DOMContentLoaded)
    function startAudioLoadingLocal() {
        console.log('startAudioLoadingLocal() chamada');
        console.log('dustinAudios:', dustinAudios);

        if (!loadingInfo || !progressBar) {
            console.error('Elementos de UI não encontrados');
            startSimpleLoading();
            return;
        }

        console.log('Elementos encontrados, iniciando carregamento real...');
        loadingInfo.innerText = "Carregando áudios...";

        const audioKeys = Object.keys(dustinAudios);
        totalAssets = audioKeys.length;
        loadedAssets = 0;

        console.log(`Carregando ${totalAssets} áudios`);
        updateLoadingProgress();

        // Carregar cada áudio de forma real
        audioKeys.forEach((key) => {
            const audioSrc = dustinAudios[key];
            console.log(`Carregando áudio ${key}: ${audioSrc}`);

            const audio = new Audio(audioSrc);
            audio.preload = 'auto';
            audio.volume = 0.8;

            // Eventos reais de carregamento
            const onLoad = () => {
                loadedAssets++;
                updateLoadingProgress();
                preloadedAudios[key] = audio;
                console.log(`Áudio ${key} carregado com sucesso (${loadedAssets}/${totalAssets})`);
                cleanup();
            };

            const onError = (error) => {
                console.warn(`Erro ao carregar áudio ${key}:`, error);
                loadedAssets++; // Contar como carregado para não travar
                updateLoadingProgress();
                cleanup();
            };

            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onLoad);
                audio.removeEventListener('error', onError);
                audio.removeEventListener('loadeddata', onLoad);
            };

            // Múltiplos eventos para garantir compatibilidade
            audio.addEventListener('canplaythrough', onLoad, { once: true });
            audio.addEventListener('loadeddata', onLoad, { once: true });
            audio.addEventListener('error', onError, { once: true });

            // Timeout de segurança
            setTimeout(() => {
                if (!preloadedAudios[key]) {
                    console.warn(`Timeout no carregamento de ${key}`);
                    onError(new Error('Timeout'));
                }
            }, 10000); // 10 segundos timeout
        });
    }

    // Iniciar carregamento após DOM estar pronto
    console.log('Iniciando sistema de carregamento...');
    console.log('Elementos disponíveis:');
    console.log('loadingInfo:', loadingInfo);
    console.log('progressBar:', progressBar);
    console.log('dustinAudios:', typeof dustinAudios !== 'undefined' ? dustinAudios : 'undefined');

    setTimeout(() => {
        console.log('Executando carregamento de áudios...');
        startAudioLoadingLocal();
    }, 1000);

    enterButton.addEventListener('click', async () => {
        console.log('Botão de entrada clicado. Tentando iniciar AR...');

        // Verificações de segurança
        if (enterButton.disabled) {
            console.log('Botão já está desabilitado, ignorando clique...');
            return;
        }

        loadingInfo.innerText = "Iniciando AR...";
        enterButton.disabled = true;
        enterButton.style.opacity = '0.6';

        // Adicionar um timeout para o caso de a inicialização travar
        const arStartTimeout = setTimeout(() => {
            if (!gameInitialized) {
                console.error('Timeout na inicialização do AR');
                loadingInfo.innerText = "Falha ao iniciar AR. Verifique as permissões e recarregue a página.";
                enterButton.innerText = "Tentar Novamente";
                enterButton.disabled = false;
                enterButton.style.opacity = '1';
            }
        }, 10000); // 10 segundos de timeout

        try {
            // Verificações de compatibilidade
            if (!navigator.xr) {
                throw new Error('WebXR não é suportado neste navegador. Use Chrome ou Edge em Android.');
            }

            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                throw new Error('WebXR requer uma conexão segura (HTTPS).');
            }

            // Verificar se AR é suportado
            const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!isARSupported) {
                throw new Error('AR não é suportado neste dispositivo.');
            }

            console.log('Iniciando sessão AR...');
            await sceneEl.enterAR();

            // Limpar timeout se chegou até aqui
            clearTimeout(arStartTimeout);

        } catch (e) {
            clearTimeout(arStartTimeout);
            console.error('Erro ao iniciar AR:', e);

            let errorMessage = e.message;
            if (e.message.includes('NotAllowedError')) {
                errorMessage = 'Permissão de câmera negada. Permita o acesso à câmera e tente novamente.';
            } else if (e.message.includes('NotFoundError')) {
                errorMessage = 'Câmera não encontrada. Verifique se seu dispositivo tem câmera.';
            }

            loadingInfo.innerText = `Erro: ${errorMessage}`;
            enterButton.innerText = "Tentar Novamente";
            enterButton.disabled = false;
            enterButton.style.opacity = '1';
        }
    });

    sceneEl.addEventListener('enter-vr', () => {
        console.log('Evento enter-vr disparado (iniciando AR)');
        // A-Frame entrou no modo AR com sucesso
        if (!gameInitialized) {
            initGame();
        }
    });

    sceneEl.addEventListener('exit-vr', () => {
        console.log('Saindo do modo AR.');
        // Opcional: resetar estado do jogo ou mostrar tela inicial
        gameInitialized = false;
        loadingScreen.classList.remove('hidden');
        loadingInfo.innerText = "Você saiu do Mundo Invertido.";
        enterButton.innerText = "Entrar Novamente";
        enterButton.disabled = false;
    });

    function initGame() {
        console.log('Inicializando jogo...');
        gameInitialized = true;

        loadingScreen.classList.add('hidden');
        document.getElementById('backpack-icon').style.display = 'flex';

        setupBackpackModal();
        setupDebugButton();
        document.getElementById('distance-meter').classList.add('show');
        setupTouchInteraction();
        setupGeolocation();

        const renderer = sceneEl.renderer;
        const xrSession = renderer.xr.getSession();
        if (xrSession) {
            setupHitTest(xrSession, renderer);
        } else {
            console.error("Sessão XR não encontrada na inicialização do jogo.");
            showToast("Erro crítico: Sessão AR perdida.", 'warning');
        }
    }

    function setupDebugButton() {
        const debugButton = document.getElementById('debug-collect');

        debugButton.addEventListener('click', () => {
            if (currentObjectPlaced && currentObjectIndex < objectsToPlace.length) {
                const currentObjectId = objectsToPlace[currentObjectIndex];

                // Tratamento especial para o Demogorgon
                if (currentObjectId === 'demogorgon') {
                    const demogorgonEntity = document.getElementById('demogorgon');
                    const demogorgonComponent = demogorgonEntity.components['demogorgon-combat'];
                    if (demogorgonComponent && demogorgonComponent.data.isActive) {
                        // Simular ataque ao Demogorgon
                        demogorgonComponent.takeDamage(100); // Dano suficiente para derrotar
                        showToast('Debug: Demogorgon derrotado!', 'success');
                    } else {
                        showToast('Debug: Demogorgon não está ativo para combate', 'warning');
                    }
                } else {
                    // Coletar item normalmente
                    collectItem(currentObjectId);
                }
            }
        });

        setInterval(() => {
            debugButton.style.display = (currentObjectPlaced && currentObjectIndex < objectsToPlace.length) ? 'block' : 'none';
        }, 1000);
    }

    function setupBackpackModal() {
        const backpackIcon = document.getElementById('backpack-icon');
        const backpackModal = document.getElementById('backpack-modal');
        const closeBackpack = document.getElementById('close-backpack');

        backpackIcon.addEventListener('click', () => {
            backpackModal.style.display = 'flex';
            updateBackpackContent();
        });
        closeBackpack.addEventListener('click', () => {
            backpackModal.style.display = 'none';
        });
        backpackModal.addEventListener('click', (e) => {
            if (e.target === backpackModal) {
                backpackModal.style.display = 'none';
            }
        });
    }

    function updateBackpackContent() {
        const progressText = document.getElementById('progress-text');
        const progressFill = document.getElementById('progress-fill');
        const backpackBadge = document.getElementById('backpack-badge');
        const totalItems = Object.keys(collectibles).length;
        progressText.innerText = `${foundCollectibles} de ${totalItems} itens coletados`;
        backpackBadge.innerText = `${foundCollectibles}/${totalItems}`;
        const progressPercent = (foundCollectibles / totalItems) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

    function showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function getObjectName(objectId) {
        const names = {
            'bike': 'Bicicleta', 'compass': 'Bússola', 'baseball-bat': 'Taco de Baseball',
            'walkie-talkie': 'Walkie-Talkie', 'demogorgon': 'Demogorgon',
            'will-mundo-invertido': 'Will (Mundo Invertido)'
        };
        return names[objectId] || 'objeto';
    }

    function highlightObject(objectEntity) {
        if (!objectEntity) return;
        objectEntity.classList.add('collectible-highlight');
        setTimeout(() => objectEntity.classList.remove('collectible-highlight'), 1000);
    }

    function setupGeolocation() {
        if (!navigator.geolocation) {
            showToast("Geolocalização não suportada.", 'warning');
            return;
        }
        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 };
        navigator.geolocation.getCurrentPosition(pos => {
            currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            checkProximityToLocations();
        }, err => console.error(err), options);
        geolocationWatchId = navigator.geolocation.watchPosition(pos => {
            currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            checkProximityToLocations();
        }, err => console.error(err), options);
    }

    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Raio da Terra em metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distância em metros
    }

    function vibrateDevice(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    function checkProximityToLocations() {
        if (!currentLocation || currentObjectIndex >= objectsToPlace.length) return;

        const currentObjectLocation = objectLocations[currentObjectIndex];
        const distance = calculateDistance(currentLocation.lat, currentLocation.lng, currentObjectLocation.lat, currentObjectLocation.lng);
        console.log(`Distância para ${currentObjectLocation.name}: ${distance.toFixed(1)}m`);

        const distanceMeter = document.getElementById('distance-meter');
        const distanceText = document.getElementById('distance-text');
        const locationStatus = document.getElementById('location-status');
        const formattedDistance = distance > 1000 ? `${(distance / 1000).toFixed(1)}km` : `${Math.round(distance)}m`;

        if (locationUnlocked[currentObjectIndex]) {
            distanceMeter.classList.add('unlocked');
            distanceText.innerHTML = `✅ ${currentObjectLocation.name} desbloqueado!`;
            if (locationStatus) locationStatus.innerHTML = `✅ ${currentObjectLocation.name} desbloqueado!`;
        } else if (distance <= PROXIMITY_RADIUS) {
            locationUnlocked[currentObjectIndex] = true;
            canPlace = true;
            vibrateDevice([300, 200, 300]);
            distanceMeter.classList.add('unlocked');
            distanceText.innerHTML = `✅ ${currentObjectLocation.name} desbloqueado!`;
            // Toast de proximidade removido
            if (locationStatus) locationStatus.innerHTML = `✅ ${currentObjectLocation.name} desbloqueado!`;
        } else {
            distanceMeter.classList.remove('unlocked');
            distanceText.innerHTML = `${currentObjectLocation.name}: ${formattedDistance}`;
            if (locationStatus) locationStatus.innerHTML = `🎯 ${currentObjectLocation.name}: ${formattedDistance}`;
        }
    }

    function setupTouchInteraction() {
        sceneEl.addEventListener('click', handleTouch);
        setupObjectClickListeners();
    }

    function setupObjectClickListeners() {
        objectsToPlace.forEach(objectId => {
            const objectElement = document.getElementById(objectId);
            if (objectElement) {
                objectElement.addEventListener('object-clicked', (event) => {
                    handleObjectClick(event.detail.objectId);
                });
            }
        });
    }

    function handleObjectClick(objectId) {
        if (currentObjectPlaced && objectsToPlace[currentObjectIndex] === objectId) {
            const objectElement = document.getElementById(objectId);
            if (objectElement && objectElement.getAttribute('visible') === true) {
                collectItem(objectId);
            }
        }
    }

    function handleTouch(event) {
        if (!currentObjectPlaced || currentObjectIndex >= objectsToPlace.length) return;
        if (event.target.closest('.ui-element')) return;

        event.preventDefault();
        event.stopPropagation();

        const currentObjectId = objectsToPlace[currentObjectIndex];
        const currentObject = document.getElementById(currentObjectId);
        if (currentObject && currentObject.getAttribute('visible') === true) {
            highlightObject(currentObject);
        }
    }

    async function setupHitTest(session, renderer) {
        try {
            const referenceSpace = await session.requestReferenceSpace('viewer');
            hitTestSource = await session.requestHitTestSource({ space: referenceSpace });
            renderer.setAnimationLoop(onXRFrame);
        } catch (error) {
            console.error('Erro ao configurar hit-test:', error);
            showToast("Erro ao detectar superfície.", 'warning');
        }
    }

    function onXRFrame(timestamp, frame) {
        if (!frame || !hitTestSource) return;
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(sceneEl.renderer.xr.getReferenceSpace());
            if (pose) {
                reticle.setAttribute('visible', true);
                reticle.object3D.matrix.fromArray(pose.transform.matrix);
                reticle.object3D.matrix.decompose(reticle.object3D.position, reticle.object3D.quaternion, reticle.object3D.scale);
                if (canPlace && !currentObjectPlaced && locationUnlocked[currentObjectIndex]) {
                    placeObject(pose);
                }
            }
        } else {
            reticle.setAttribute('visible', false);
        }

        // Renderização manual necessária quando usando setAnimationLoop customizado
        // A-Frame não renderiza automaticamente neste caso
        if (sceneEl.renderer && sceneEl.object3D && sceneEl.camera) {
            sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
        }
    }

    function placeObject(pose) {
        const objectId = objectsToPlace[currentObjectIndex];
        const objectEntity = document.getElementById(objectId);

        if (!objectEntity) {
            console.error('Entidade não encontrada para:', objectId);
            return;
        }

        objectEntity.object3D.matrix.fromArray(pose.transform.matrix);
        objectEntity.object3D.matrix.decompose(objectEntity.object3D.position, objectEntity.object3D.quaternion, objectEntity.object3D.scale);

        const scales = {
            'bike': 0.4, 'demogorgon': 0.8, 'baseball-bat': 1.5,
            'compass': 10, 'walkie-talkie': 0.6,
            'will-mundo-invertido': 1
        };
        const scale = scales[objectId] || 0.5;
        objectEntity.object3D.scale.set(scale, scale, scale);

        objectEntity.setAttribute('visible', true);
        currentObjectPlaced = true;
        window.currentObjectPlaced = true;
        console.log('Objeto colocado:', objectId);

        // Tratamento especial para o Demogorgon
        if (objectId === 'demogorgon') {
            // Iniciar combate manualmente
            const objectName = getObjectName(objectId);
            showToast(`${objectName} apareceu.`, 'info');

            // Iniciar combate após um pequeno delay
            setTimeout(() => {
                const demogorgonComponent = objectEntity.components['demogorgon-combat'];
                if (demogorgonComponent) {
                    demogorgonComponent.startCombat();
                } else {
                    console.error('Componente demogorgon-combat não encontrado');
                }
            }, 500);
        } else {
            objectEntity.classList.add('collectible-ready');
            const objectName = getObjectName(objectId);
            showToast(`${objectName} encontrado.`, 'success');
        }
        canPlace = false;
    }

    function prepareForNextObject() {
        currentObjectIndex++;
        currentObjectPlaced = false;

        // Sincronizar variáveis globais corretamente
        window.currentObjectIndex = currentObjectIndex;
        window.currentObjectPlaced = currentObjectPlaced;
        window.objectsToPlace = objectsToPlace;

        if (currentObjectIndex < objectsToPlace.length) {
            const nextObjectId = objectsToPlace[currentObjectIndex];
            const nextObjectName = getObjectName(nextObjectId);
            showToast(`${nextObjectName} desbloqueado!`, 'info', 4000);
            canPlace = false;
            setTimeout(checkProximityToLocations, 1500);
        } else {
            showVictoryScreen();
        }
    }

    function collectItem(id) {
        if (collectibles[id]) {
            console.log(`Item ${id} já foi coletado, ignorando...`);
            return;
        }

        console.log(`Coletando item: ${id}`);
        collectibles[id] = true;
        foundCollectibles++;
        vibrateDevice([100, 50, 100]);

        const entity = document.getElementById(id);
        if (entity) {
            entity.setAttribute('visible', 'false');
            entity.classList.remove('collectible-ready');

            // Limpeza de componentes específicos
            if (id === 'demogorgon') {
                const demogorgonComponent = entity.components['demogorgon-combat'];
                if (demogorgonComponent && demogorgonComponent.remove) {
                    demogorgonComponent.remove();
                }
            }
        }

        const listItem = document.querySelector(`#collectibles-list li[data-item="${id}"]`);
        if (listItem) {
            listItem.classList.add('found');
            const statusIcon = listItem.querySelector('.item-status');
            if (statusIcon) statusIcon.innerText = '✅';
        }

        updateBackpackContent();

        // Tornar função disponível globalmente para componentes
        window.collectItem = collectItem;

        // Sistema de ligações progressivas do Dustin
        console.log('collectItem chamada para:', id);
        console.log('dustinAudios disponível:', typeof dustinAudios !== 'undefined');
        console.log('dustinAudios[id]:', dustinAudios ? dustinAudios[id] : 'dustinAudios não definido');

        if (dustinAudios && dustinAudios[id]) {
            console.log('Iniciando ligação do Dustin para item:', id);
            // Delay de 3 segundos para dar tempo do jogador ver o item sendo coletado
            setTimeout(() => {
                console.log('Executando showDustinCall para:', id);
                showDustinCall(id);
            }, 3000);
        } else {
            console.log('Nenhum áudio encontrado para:', id, '- preparando próximo objeto');
            setTimeout(prepareForNextObject, 1500);
        }
    }

    function showVictoryScreen() {
        console.log('Mostrando tela de vitória - limpando recursos...');

        // Limpeza de recursos de geolocalização
        if (geolocationWatchId) {
            navigator.geolocation.clearWatch(geolocationWatchId);
            geolocationWatchId = null;
        }

        // Limpeza de timers e intervals ativos
        if (callTimerInterval) {
            clearInterval(callTimerInterval);
            callTimerInterval = null;
        }

        if (vibrationInterval) {
            clearInterval(vibrationInterval);
            vibrationInterval = null;
        }

        // Parar vibração
        if (navigator.vibrate) {
            navigator.vibrate(0);
        }

        // Limpeza de áudio
        if (dustinAudio) {
            dustinAudio.pause();
            dustinAudio = null;
        }

        // Esconder elementos da UI
        document.getElementById('backpack-icon').style.display = 'none';
        document.getElementById('backpack-modal').style.display = 'none';
        document.getElementById('distance-meter').classList.remove('show');
        document.getElementById('combat-ui').classList.remove('show');

        // Mostrar tela de vitória
        victoryScreen.classList.remove('hidden');

        // Vibração de vitória
        vibrateDevice([200, 100, 200, 100, 200, 100, 500]);
    }

    // Componente A-Frame para combate do Demogorgon
    AFRAME.registerComponent('demogorgon-combat', {
        schema: {
            maxHealth: { type: 'number', default: 100 },
            damage: { type: 'number', default: 10 },
            isActive: { type: 'boolean', default: false }
        },

        init: function () {
            console.log('Inicializando sistema de combate do Demogorgon');

            this.health = this.data.maxHealth;
            this.isDead = false;
            this.isTargeted = false;
            this.combatStarted = false;

            // Elementos da UI
            this.combatUI = document.getElementById('combat-ui');
            this.healthBar = document.getElementById('health-bar');
            this.healthValue = document.getElementById('health-value');

            // Bind dos métodos para evitar problemas de contexto
            this.boundOnAttack = this.onAttack.bind(this);
            this.boundOnTargetEnter = this.onTargetEnter.bind(this);
            this.boundOnTargetLeave = this.onTargetLeave.bind(this);

            // Eventos de combate
            this.el.addEventListener('click', this.boundOnAttack);
            this.el.addEventListener('touchstart', this.boundOnAttack);
            this.el.addEventListener('mousedown', this.boundOnAttack);

            // Eventos de mira
            this.el.addEventListener('mouseenter', this.boundOnTargetEnter);
            this.el.addEventListener('mouseleave', this.boundOnTargetLeave);
            this.el.addEventListener('raycaster-intersected', this.boundOnTargetEnter);
            this.el.addEventListener('raycaster-intersected-cleared', this.boundOnTargetLeave);

            // Verificação periódica para iniciar combate quando visível
            this.visibilityCheck = setInterval(() => {
                if (!this.combatStarted && this.el.getAttribute('visible') === true) {
                    console.log('Demogorgon detectado como visível, iniciando combate...');
                    this.startCombat();
                    this.clearVisibilityCheck();
                }
            }, 500);

            // Limpar interval após 30 segundos para evitar vazamentos
            this.cleanupTimeout = setTimeout(() => {
                this.clearVisibilityCheck();
            }, 30000);
        },

        // Método para limpeza adequada do interval
        clearVisibilityCheck: function () {
            if (this.visibilityCheck) {
                clearInterval(this.visibilityCheck);
                this.visibilityCheck = null;
            }
        },

        // Método de limpeza geral
        remove: function () {
            this.clearVisibilityCheck();

            if (this.cleanupTimeout) {
                clearTimeout(this.cleanupTimeout);
                this.cleanupTimeout = null;
            }

            // Remover event listeners
            if (this.boundOnAttack) {
                this.el.removeEventListener('click', this.boundOnAttack);
                this.el.removeEventListener('touchstart', this.boundOnAttack);
                this.el.removeEventListener('mousedown', this.boundOnAttack);
            }

            if (this.boundOnTargetEnter && this.boundOnTargetLeave) {
                this.el.removeEventListener('mouseenter', this.boundOnTargetEnter);
                this.el.removeEventListener('mouseleave', this.boundOnTargetLeave);
                this.el.removeEventListener('raycaster-intersected', this.boundOnTargetEnter);
                this.el.removeEventListener('raycaster-intersected-cleared', this.boundOnTargetLeave);
            }

            // Esconder UI de combate
            if (this.combatUI) {
                this.combatUI.classList.remove('show');
            }
        },

        startCombat: function () {
            if (this.combatStarted) {
                console.log('Combate já foi iniciado, ignorando...');
                return;
            }

            console.log('Iniciando combate com o Demogorgon!');
            this.combatStarted = true;
            this.data.isActive = true;
            this.health = this.data.maxHealth;
            this.isDead = false;

            // Mostrar UI de combate
            this.combatUI.classList.add('show');
            this.updateHealthUI();

            // Animação de spawn
            this.el.classList.add('demogorgon-spawn');

            // Remover animação após completar
            setTimeout(() => {
                this.el.classList.remove('demogorgon-spawn');
            }, 1500);

            // Toast de início de combate (mensagem simplificada)
            this.showCombatToast('👹 Demogorgon apareceu!', 'info');

            // Vibração de alerta
            this.vibrateDevice([200, 100, 200, 100, 200]);
        },

        onAttack: function (event) {
            if (!this.data.isActive || this.isDead) return;

            event.stopPropagation();
            event.preventDefault();

            console.log('Atacando o Demogorgon!');

            // Aplicar dano
            this.takeDamage(this.data.damage);

            // Animação de hit
            this.el.classList.add('demogorgon-hit');
            setTimeout(() => {
                this.el.classList.remove('demogorgon-hit');
            }, 600);

            // Vibração de ataque
            this.vibrateDevice([50, 30, 50]);

            // Som de ataque (se disponível)
            this.playAttackSound();
        },

        takeDamage: function (damage) {
            this.health = Math.max(0, this.health - damage);
            console.log(`Demogorgon recebeu ${damage} de dano. Vida restante: ${this.health}`);

            this.updateHealthUI();

            if (this.health <= 0) {
                this.die();
            } else {
                // Toast de dano
                this.showCombatToast(`-${damage} HP`, 'success');
            }
        },

        die: function () {
            console.log('Demogorgon foi derrotado!');

            this.isDead = true;
            this.data.isActive = false;

            // Animação de morte
            this.el.classList.add('demogorgon-death');

            // Esconder UI de combate
            setTimeout(() => {
                this.combatUI.classList.remove('show');
            }, 500);

            // Toast de vitória
            this.showCombatToast('🎉 Demogorgon derrotado! Você salvou Hawkins!', 'success');

            // Vibração de vitória
            this.vibrateDevice([100, 50, 100, 50, 100, 50, 200]);

            // Marcar como coletado após animação
            setTimeout(() => {
                this.collectDemogorgon();
            }, 2000);
        },

        collectDemogorgon: function () {
            console.log('collectDemogorgon chamada - iniciando coleta do Demogorgon');

            // Marcar como coletado no sistema principal
            if (window.collectItem) {
                console.log('Chamando window.collectItem para demogorgon');
                window.collectItem('demogorgon');
            } else {
                console.log('window.collectItem não encontrada, usando fallback');
                // Fallback manual
                const collectiblesFallback = window.collectibles || {};
                collectiblesFallback['demogorgon'] = true;

                const listItem = document.querySelector(`#collectibles-list li[data-item="demogorgon"]`);
                if (listItem) {
                    listItem.classList.add('found');
                    const statusIcon = listItem.querySelector('.item-status');
                    if (statusIcon) statusIcon.innerText = '✅';
                }

                // Atualizar contador
                const foundCount = Object.values(collectiblesFallback).filter(Boolean).length;
                const badge = document.getElementById('backpack-badge');
                if (badge) badge.textContent = `${foundCount}/6`;

                // Chamar ligação do Dustin manualmente no fallback
                if (window.dustinAudios && window.dustinAudios['demogorgon']) {
                    console.log('Iniciando ligação do Dustin para demogorgon (fallback)');
                    setTimeout(() => {
                        if (window.showDustinCall) {
                            window.showDustinCall('demogorgon');
                        }
                    }, 3000);
                }
            }

            // Esconder o Demogorgon
            this.el.setAttribute('visible', false);
        },

        onTargetEnter: function () {
            if (!this.data.isActive || this.isDead) return;

            console.log('Mirando no Demogorgon');
            this.isTargeted = true;
            this.el.classList.add('demogorgon-targeted');

            // Mostrar cursor de mira
            const cursor = document.getElementById('cursor');
            if (cursor) {
                cursor.setAttribute('visible', true);
                cursor.setAttribute('material', 'color: #ff0000');
            }

            document.body.style.cursor = 'crosshair';
        },

        onTargetLeave: function () {
            if (!this.data.isActive || this.isDead) return;

            console.log('Saindo da mira do Demogorgon');
            this.isTargeted = false;
            this.el.classList.remove('demogorgon-targeted');

            // Esconder cursor
            const cursor = document.getElementById('cursor');
            if (cursor) {
                cursor.setAttribute('visible', false);
                cursor.setAttribute('material', 'color: #e72626');
            }

            document.body.style.cursor = 'default';
        },

        updateHealthUI: function () {
            const healthPercent = (this.health / this.data.maxHealth) * 100;

            this.healthBar.style.width = `${healthPercent}%`;
            this.healthValue.textContent = this.health;

            // Mudar cor da barra baseado na vida
            this.healthBar.classList.remove('low', 'critical');
            if (healthPercent <= 20) {
                this.healthBar.classList.add('critical');
            } else if (healthPercent <= 50) {
                this.healthBar.classList.add('low');
            }
        },

        showCombatToast: function (message, type = 'info') {
            const toastContainer = document.getElementById('toast-container');
            if (!toastContainer) return;

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;

            toastContainer.appendChild(toast);

            // Mostrar toast
            setTimeout(() => toast.classList.add('show'), 100);

            // Remover toast
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toastContainer.removeChild(toast), 300);
            }, 3000);
        },

        vibrateDevice: function (pattern) {
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        },

        playAttackSound: function () {
            // Placeholder para som de ataque
            // Você pode adicionar um arquivo de áudio aqui
            console.log('🔊 Som de ataque!');
        }
    });

});
