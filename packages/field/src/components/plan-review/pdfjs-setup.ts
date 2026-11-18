import './pdfjs-polyfills';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
// Native embeds the parser on its UI thread; browsers can use a dedicated worker.
GlobalWorkerOptions.workerSrc=workerUrl;
