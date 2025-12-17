import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Remover card "Made in Bolt" - Solução agressiva e contínua
const removeBoltCard = () => {
  try {
    // 1. Procurar por elementos com seletores específicos do Bolt
    const selectors = [
      '[data-bolt]',
      '[class*="bolt"]',
      '[class*="Bolt"]',
      '[id*="bolt"]',
      '[id*="Bolt"]',
      'a[href*="bolt"]',
      'a[href*="Bolt"]',
      '*[style*="position: fixed"]',
      '*[style*="position:fixed"]',
    ];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = (el.textContent || el.innerText || '').toLowerCase();
          const html = (el.innerHTML || '').toLowerCase();
          
          // Verificar se contém texto relacionado ao Bolt
          if (text.includes('bolt') || text.includes('made in') || html.includes('bolt') || html.includes('made in')) {
            const htmlEl = el as HTMLElement;
            htmlEl.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important;';
            el.remove();
          }
        });
      } catch (e) {
        // Ignorar erros de seletores inválidos
      }
    });

    // 2. Procurar por TODOS os elementos e verificar posição e conteúdo
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      try {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        const text = (el.textContent || el.innerText || '').toLowerCase();
        const html = (el.innerHTML || '').toLowerCase();
        
        // Verificar se é um elemento fixo no canto inferior direito
        const isFixed = style.position === 'fixed' || style.position === 'absolute';
        const isBottomRight = 
          (style.bottom !== 'auto' && parseFloat(style.bottom) < 100) ||
          (style.right !== 'auto' && parseFloat(style.right) < 100);
        
        // Verificar se contém texto do Bolt
        const hasBoltText = text.includes('bolt') || text.includes('made in') || 
                           html.includes('bolt') || html.includes('made in');
        
        if (isFixed && isBottomRight && hasBoltText) {
          htmlEl.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important;';
          el.remove();
        }
        
        // Também remover se tiver atributos relacionados ao Bolt
        if (hasBoltText && (el.hasAttribute('data-bolt') || 
            el.className?.toLowerCase().includes('bolt') ||
            el.id?.toLowerCase().includes('bolt'))) {
          htmlEl.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
          el.remove();
        }
      } catch (e) {
        // Ignorar erros
      }
    });

    // 3. Remover tooltips relacionados
    const tooltips = document.querySelectorAll('[role="tooltip"], .tooltip, [class*="tooltip"]');
    tooltips.forEach(tooltip => {
      const text = (tooltip.textContent || '').toLowerCase();
      if (text.includes('bolt') || text.includes('pro plan') || text.includes('upgrade')) {
        (tooltip as HTMLElement).style.cssText = 'display: none !important;';
        tooltip.remove();
      }
    });
  } catch (error) {
    // Ignorar erros silenciosamente
  }
};

// Executar imediatamente
if (document.body) {
  removeBoltCard();
} else {
  document.addEventListener('DOMContentLoaded', removeBoltCard);
}

// Observar mudanças no DOM de forma mais agressiva
const observer = new MutationObserver(() => {
  removeBoltCard();
});

// Iniciar observação quando o body estiver disponível
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'id'],
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'id'],
    });
  });
}

// Verificação contínua a cada 500ms (mais agressivo)
setInterval(removeBoltCard, 500);

// Também verificar quando a página estiver totalmente carregada
window.addEventListener('load', removeBoltCard);
document.addEventListener('load', removeBoltCard);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
