// Gatekeeper qualité : exécute les vérifications dans l'ordre, s'arrête au
// premier échec et refuse de tourner ailleurs que sur une base de test dédiée.
type Step = {
  readonly label: string;
  readonly command: readonly string[];
  readonly testDatabase: boolean;
};

const TOTAL_STEPS = 4;

const steps: readonly Step[] = [
  { label: 'Lint', command: ['bunx', '@biomejs/biome', 'check', '.'], testDatabase: false },
  { label: 'Typecheck', command: ['bun', 'run', 'typecheck'], testDatabase: false },
  {
    label: 'Base de données',
    command: ['bun', 'run', '--cwd', 'packages/db', 'ping'],
    testDatabase: true,
  },
  { label: 'Spécifications', command: ['bun', 'test', 'packages/spec'], testDatabase: true },
];

function fail(message: string): never {
  console.error(`[hexamap] ✗ ${message}`);
  process.exit(1);
}

// Aucune exécution ne doit pouvoir viser une base de production.
if (process.env.NODE_ENV === 'production') {
  fail('Refus de lancer le gatekeeper en production : il toucherait une base de production.');
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  fail(
    [
      'TEST_DATABASE_URL est absente.',
      'Le gatekeeper exige une base de test dédiée :',
      'TEST_DATABASE_URL=postgres://hexamap:hexamap@localhost:5432/hexamap_test',
    ].join(' '),
  );
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (databaseUrl === testDatabaseUrl) {
  fail(
    'TEST_DATABASE_URL est identique à DATABASE_URL : le gatekeeper ne doit jamais tourner sur la base de développement.',
  );
}

for (const [index, step] of steps.entries()) {
  const badge = `${index + 1}/${TOTAL_STEPS}`;
  console.log(`[hexamap] ▶ ${badge} ${step.label}`);

  const env = step.testDatabase ? { ...process.env, DATABASE_URL: testDatabaseUrl } : process.env;

  const proc = Bun.spawn([...step.command], {
    stdout: 'inherit',
    stderr: 'inherit',
    env,
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`[hexamap] ✗ ${badge} ${step.label} (code ${exitCode})`);
    process.exit(exitCode);
  }

  console.log(`[hexamap] ✓ ${badge} ${step.label}`);
}

console.log('[hexamap] ✓ Gatekeeper vert.');
