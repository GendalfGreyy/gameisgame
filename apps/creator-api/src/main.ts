import { createApp, resolvePort } from './app.factory.js';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(resolvePort(app), '0.0.0.0');
}

void bootstrap();
