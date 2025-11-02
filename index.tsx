import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { I18nProvider } from './src/i18n';


// ======================================================================
// == ADICIONE ESTE BLOCO DE CÓDIGO ==
// ======================================================================
// Importe a biblioteca pdfjs de react-pdf, que é a que seus componentes usarão
import { pdfjs } from 'react-pdf';

// Defina o caminho para o worker usando a mesma CDN e versão
// que você está usando para as outras bibliotecas no seu importmap.
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;
// ======================================================================


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);