const dsn=import.meta.env.VITE_FIELD_SENTRY_DSN??'';
export const monitoringEnabled=import.meta.env.PROD&&Boolean(dsn);
let sdk:Promise<typeof import('@sentry/react')>|undefined;
function start(){return sdk??=import('@sentry/react').then(Sentry=>{
 Sentry.init({dsn,environment:import.meta.env.VITE_FIELD_SENTRY_ENVIRONMENT||'production',release:import.meta.env.VITE_FIELD_RELEASE||undefined,integrations:[Sentry.browserTracingIntegration(),Sentry.replayIntegration({maskAllText:true,blockAllMedia:true})],tracesSampleRate:0.1,replaysSessionSampleRate:0.1,replaysOnErrorSampleRate:1});
 return Sentry;
});}
// Monitoring must not add its parser/replay cost to the initial Field Tools render.
if(monitoringEnabled)window.addEventListener('load',()=>{void start().catch(()=>{});},{once:true});
export function reportRenderError(error:unknown){if(monitoringEnabled)void start().then(Sentry=>Sentry.captureException(error)).catch(()=>{});}
