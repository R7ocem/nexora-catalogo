'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function tocarAlerta() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const contexto = new AudioContext();
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.value = 880;
    ganho.gain.value = 0.08;
    oscilador.connect(ganho);
    ganho.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.18);
  } catch {
    // Navegadores podem bloquear audio antes de interacao do usuario.
  }
}

export default function OrdersAutoRefresh({ company, filter }) {
  const router = useRouter();
  const assinaturaRef = useRef(null);
  const primeiroCarregamentoRef = useRef(true);
  const [notificacao, setNotificacao] = useState('');

  useEffect(() => {
    if (!company) return undefined;

    let cancelado = false;
    let timer = null;

    async function consultar() {
      try {
        const params = new URLSearchParams({ company, filter: filter || 'novo' });
        const resposta = await fetch(`/api/admin/orders/summary?${params.toString()}`, {
          cache: 'no-store'
        });

        if (!resposta.ok) return;

        const dados = await resposta.json();
        const assinatura = dados.signature || '';

        if (!assinaturaRef.current) {
          assinaturaRef.current = assinatura;
          primeiroCarregamentoRef.current = false;
          return;
        }

        if (assinatura && assinatura !== assinaturaRef.current) {
          assinaturaRef.current = assinatura;

          if (!primeiroCarregamentoRef.current) {
            setNotificacao('Pedidos atualizados agora.');
            tocarAlerta();
            router.refresh();

            window.setTimeout(() => {
              if (!cancelado) setNotificacao('');
            }, 4500);
          }
        }
      } finally {
        if (!cancelado) {
          timer = window.setTimeout(consultar, 5000);
        }
      }
    }

    consultar();

    return () => {
      cancelado = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [company, filter, router]);

  return notificacao ? (
    <div className="orders-live-notice" role="status" aria-live="polite">
      {notificacao}
    </div>
  ) : null;
}
