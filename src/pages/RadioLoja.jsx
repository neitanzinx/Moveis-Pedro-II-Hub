import React, { useState, useEffect, useRef } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Cast, Loader2, Play, Pause, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STREAM_URL = "https://sv15.hdradios.net:6858/stream";
const METADATA_ENDPOINTS = [
  "https://sv15.hdradios.net:6858/status-json.xsl",
  "https://sv15.hdradios.net:6858/stats?json=1",
];

export default function RadioLoja() {
  const { brandName, brandLogo } = useTenant();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [isMuted, setIsMuted] = useState(false);
  const [songName, setSongName] = useState("Procurando informações...");
  const [isLoading, setIsLoading] = useState(true);
  const [isCasting, setIsCasting] = useState(false);
  const [showCastGuide, setShowCastGuide] = useState(false);
  const audioRef = useRef(null);
  const [castAvailable, setCastAvailable] = useState(false);

  // Cast Initialization
  useEffect(() => {
    const initializeCastApi = () => {
      const cast = window.cast;
      const chrome = window.chrome;
      if (!cast || !cast.framework || !chrome?.cast) return;

      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      // Listener: quando uma sessão Cast é estabelecida, enviar a mídia automaticamente
      context.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event) => {
          const { SessionState } = cast.framework;
          if (
            event.sessionState === SessionState.SESSION_STARTED ||
            event.sessionState === SessionState.SESSION_RESUMED
          ) {
            setIsCasting(true);
            sendMediaToCast();
          } else if (event.sessionState === SessionState.SESSION_ENDED) {
            setIsCasting(false);
            toast.info("Transmissão encerrada.");
          }
        }
      );

      setCastAvailable(true);
    };

    // A API do Google Cast chama esta função quando está pronta
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) initializeCastApi();
    };

    if (!document.getElementById('cast-sdk')) {
      const script = document.createElement('script');
      script.id = 'cast-sdk';
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      document.body.appendChild(script);
    } else if (window.cast?.framework) {
      initializeCastApi();
    }
  }, []); // roda apenas uma vez

  /**
   * Envia a stream de áudio para o Chromecast.
   * Deve ser chamado DEPOIS que a sessão já foi criada.
   */
  const sendMediaToCast = () => {
    try {
      const chromeCast = window.chrome?.cast;
      if (!chromeCast) return;

      const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
      if (!castSession) {
        toast.error('Nenhuma sessão Cast ativa.');
        return;
      }

      const mediaInfo = new chromeCast.media.MediaInfo(STREAM_URL, 'audio/mpeg');
      mediaInfo.streamType = chromeCast.media.StreamType.LIVE;
      mediaInfo.metadata = new chromeCast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = songName !== 'Procurando informações...' ? songName : 'Rádio Samambaia';
      mediaInfo.metadata.artist = brandName || 'Loja';
      if (brandLogo) {
        mediaInfo.metadata.images = [new chromeCast.Image(brandLogo)];
      }

      const request = new chromeCast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      castSession.loadMedia(request).then(
        () => toast.success('Tocando na TV! 📺'),
        (err) => {
          console.error('Erro ao carregar mídia no Cast:', err);
          toast.error('Não foi possível enviar o áudio para a TV.');
        }
      );
    } catch (e) {
      console.error('Erro inesperado no Cast:', e);
      toast.error('Erro ao iniciar transmissão.');
    }
  };

  /**
   * Botão de Cast: abre o seletor de dispositivos (se não conectado)
   * ou envia mídia (se já conectado).
   */
  const handleCast = () => {
    if (!castAvailable) {
      toast.error('Chromecast não detectado. Certifique-se de estar no mesmo Wi-Fi.');
      return;
    }

    const context = window.cast.framework.CastContext.getInstance();
    const currentSession = context.getCurrentSession();

    if (currentSession) {
      // Já conectado: apenas reenvia a mídia
      sendMediaToCast();
    } else {
      // Abre o seletor nativo de Chromecasts
      context.requestSession().then(
        () => { /* O listener de SESSION_STARTED cuida do resto */ },
        (err) => {
          if (err?.code !== 'cancel') {
            toast.error('Erro ao conectar no Chromecast.');
            console.error(err);
          }
        }
      );
    }
  };

  // Áudio Local e Autoplay
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume[0] / 100;
      
      const playAudio = async () => {
        try {
          setIsLoading(true);
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          console.log("Autoplay bloqueado pelo navegador.", err);
          setIsPlaying(false);
          toast.info("Clique no play para iniciar a rádio.");
        } finally {
          setIsLoading(false);
        }
      };

      playAudio();
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => toast.error("Não foi possível iniciar o áudio."))
        .finally(() => setIsLoading(false));
    }
  };

  const handleVolumeChange = (value) => {
    const vol = value[0];
    setVolume([vol]);
    setIsMuted(vol === 0);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  };

  // Buscando Metadados (Polling)
  useEffect(() => {
    let intervalId;

    const fetchSongData = async () => {
      // Tentativa simples via JSON para Shoutcast/Icecast
      for (const endpoint of METADATA_ENDPOINTS) {
        try {
          const response = await fetch(endpoint, { cache: "no-store", mode: 'cors' });
          if (!response.ok) continue;
          
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            
            // Lógica comum para Shoutcast v2 / Icecast v2
            if (data?.icestats?.source) {
              const source = Array.isArray(data.icestats.source) ? data.icestats.source[0] : data.icestats.source;
              if (source?.title) {
                setSongName(source.title);
                return;
              }
            } else if (data?.title) {
              setSongName(data.title);
              return;
            } else if (data?.streamtitle) {
                setSongName(data.streamtitle);
                return;
            }
          } catch (e) {
            // Pode ser ICY text plain, algumas rádios retornam text/html
          }
        } catch (err) {
          console.warn("Erro ao buscar metadados", endpoint);
        }
      }
      // Fallback
      if (songName === "Procurando informações...") {
        setSongName("Rádio Samambaia ao Vivo");
      }
    };

    fetchSongData();
    intervalId = setInterval(fetchSongData, 15000); // Atualiza a cada 15 segundos

    return () => clearInterval(intervalId);
  }, []);


  return (
    <div className="min-h-screen flex flex-col justify-between overflow-hidden relative font-sans text-white bg-green-950">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        .font-serif { fontFamily: 'Playfair Display', serif; }
        .font-body { fontFamily: 'Lato', sans-serif; }
        @keyframes eq {
          0%, 100% { height: 10px; }
          50% { height: 35px; }
        }
        .animate-eq { animation: eq 1s ease-in-out infinite; }
      `}</style>
      
      {/* Background Image Immersive */}
      <div className="absolute inset-0 z-0">
        <div 
            className="absolute inset-0 bg-cover bg-center transform scale-105"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop')` }}
        ></div>
        {/* Overlay degradê escuro sofisticado */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-950/95 via-green-950/80 to-transparent"></div>
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Elemento de animação suave se tocando */}
        {isPlaying && (
          <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/20 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>
        )}
      </div>

      {/* Áudio Oculto */}
      <audio ref={audioRef} src={STREAM_URL} preload="auto" />

      {/* Cabeçalho - Logo e Nome (Esqueda Superior) */}
      <div className="z-10 p-12 flex flex-col items-start space-y-4 animate-in fade-in slide-in-from-left-10 duration-1000">
        <div className="flex items-center gap-8">
          {brandLogo ? (
            <div className="w-32 h-32 rounded-2xl bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center p-4 shadow-2xl">
              <img src={brandLogo} alt="Logo da Loja" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
          ) : (
             <div className="w-32 h-32 rounded-2xl bg-green-900/80 backdrop-blur-md border border-amber-500/30 flex items-center justify-center text-4xl shadow-2xl shadow-green-900/50">
               <Radio className="w-12 h-12 text-amber-400" />
             </div>
          )}
          
          <div>
            <h1 className="text-6xl md:text-7xl font-serif font-bold tracking-tight text-white drop-shadow-2xl">
              {brandName || 'Sua Loja'}
            </h1>
            <p className="text-2xl mt-4 font-body text-amber-200/80 font-light tracking-[0.2em] uppercase">
              Tocando Rádio Samambaia
            </p>
          </div>
        </div>
      </div>

      {/* Centro - Nome da Música */}
      <div className="z-10 flex-1 flex flex-col items-start justify-center p-12 max-w-5xl">
        <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
           {songName !== "Procurando informações..." && songName !== "Rádio Samambaia ao Vivo" && (
             <>
               {/* Equalizador animado minimalista */}
               <div className={`flex items-end gap-1.5 mb-8 h-12 ${isPlaying ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}>
                 {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-1.5 bg-amber-400 rounded-full animate-eq" style={{ animationDelay: `${i*0.15}s` }}></div>
                 ))}
               </div>

               <h2 className="text-5xl md:text-8xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-stone-100 to-stone-400 leading-tight drop-shadow-2xl">
                 {songName}
               </h2>
             </>
           )}
        </div>
      </div>

      {/* Rodapé - Controles (Slider, Play, Cast) */}
      <div className="z-10 w-full pb-8 pt-12 px-6 bg-gradient-to-t from-green-950/90 to-transparent">
        <div className="max-w-2xl mx-auto backdrop-blur-xl bg-white/5 border border-white/10 p-3 pl-4 pr-6 rounded-full flex items-center gap-6 shadow-2xl">
          
          {/* Botão Play/Pause */}
          <Button 
            onClick={togglePlay}
            size="icon"
            className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-green-950 shrink-0 transition-transform hover:scale-105 active:scale-95 border-none shadow-[0_0_30px_rgba(251,191,36,0.3)]"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-green-950" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-1" />
            )}
          </Button>

          {/* Volume Slider */}
          <div className="flex-1 flex items-center gap-4">
            <button onClick={() => handleVolumeChange([isMuted ? 50 : 0])} className="text-stone-400 hover:text-white transition-colors">
              {isMuted || volume[0] === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <Slider
              defaultValue={[100]}
              max={100}
              step={1}
              value={volume}
              onValueChange={handleVolumeChange}
              className="w-full cursor-grab active:cursor-grabbing [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-amber-500 [&_.bg-primary]:to-amber-300 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_[role=slider]]:shadow-[0_0_10px_rgba(251,191,36,0.5)] [&_[role=slider]]:w-5 [&_[role=slider]]:h-5"
            />
          </div>

           {/* Cast Button */}
          <div className="shrink-0 flex items-center gap-3 pr-2">
             <google-cast-launcher style={{ '--connected-color': '#fcd34d', '--disconnected-color': 'rgba(255,255,255,0.5)', width: '28px', height: '28px' }}></google-cast-launcher>

             <Button 
               variant="outline" 
               className="bg-white/5 border-white/20 text-white hover:bg-white/20 hover:text-amber-300 font-body transition-all rounded-full px-5 h-10 uppercase tracking-widest text-[10px]"
               onClick={() => setShowCastGuide(true)}
             >
               <Cast className="w-3 h-3 mr-2" />
               Espelhar TV
             </Button>
          </div>
        </div>
      </div>

      {/* Modal de Guia: Como Espelhar para a TV */}
      {showCastGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md"
          onClick={() => setShowCastGuide(false)}
        >
          <div
            className="max-w-lg w-full bg-green-950/95 border border-white/10 rounded-3xl p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-2xl font-bold text-white">Como exibir na TV</h3>
              <button
                onClick={() => setShowCastGuide(false)}
                className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-stone-300 font-body text-sm mb-6 leading-relaxed">
              Para que a TV exiba <strong className="text-amber-300">exatamente esta tela</strong> — com logo, nome da música e controles — utilize o espelhamento de guia nativo do Chrome:
            </p>

            <ol className="space-y-4 mb-8">
              {[
                { step: '1', text: <>Clique no ícone de <strong className="text-amber-300">três pontos</strong> (⋮) no canto superior direito do Chrome</> },
                { step: '2', text: <>Clique em <strong className="text-amber-300">&quot;Transmitir...&quot;</strong> no menu</> },
                { step: '3', text: <>Em <em className="text-stone-300">&quot;Transmitir para&quot;</em>, selecione <strong className="text-amber-300">&quot;Transmitir guia&quot;</strong> (não "Transmitir arquivo")</> },
                { step: '4', text: <>Escolha seu Chromecast na lista e pronto — a TV mostrará exatamente esta tela!</> },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-amber-500 text-green-950 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                  <span className="text-stone-200 font-body text-sm leading-relaxed">{text}</span>
                </li>
              ))}
            </ol>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
              <Cast className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-stone-400 font-body text-xs leading-relaxed">
                O som tocará nos <strong className="text-stone-200">alto-falantes da TV</strong> e a imagem será idêntica ao PC. A música não para no computador enquanto transmite.
              </p>
            </div>

            <Button
              className="w-full mt-6 bg-gradient-to-r from-amber-400 to-amber-600 text-green-950 font-bold rounded-full h-12 hover:from-amber-300 hover:to-amber-500"
              onClick={() => setShowCastGuide(false)}
            >
              Entendido!
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
