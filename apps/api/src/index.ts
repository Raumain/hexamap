import { app } from './app';
import { env } from './env';

app.listen(env.PORT);

console.log(`[hexamap] API prête sur http://localhost:${env.PORT}`);
