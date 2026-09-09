import { getConnectionToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Connection } from 'mongoose';
import { AppModule } from '../app.module';

async function resetTestDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database reset is disabled in production');
  }

  if (process.env.ALLOW_DATABASE_RESET !== 'true') {
    throw new Error(
      'Set ALLOW_DATABASE_RESET=true to confirm the test-data reset',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const databaseName = connection.db?.databaseName;

    if (!databaseName) {
      throw new Error('Unable to resolve the connected MongoDB database name');
    }

    if (/prod|production|live/i.test(databaseName)) {
      throw new Error(`Refusing to reset protected database "${databaseName}"`);
    }

    console.log(`Dropping disposable test database "${databaseName}"`);
    await connection.dropDatabase();
    console.log(`Database "${databaseName}" was reset successfully`);
  } finally {
    await app.close();
  }
}

void resetTestDatabase();
