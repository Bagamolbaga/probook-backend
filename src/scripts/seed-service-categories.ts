import { getModelToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { ServiceCategory } from '../service-categories/schema/service-category.schema';

async function seedServiceCategories() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const categoryModel = app.get<Model<ServiceCategory>>(
      getModelToken(ServiceCategory.name),
      { strict: false },
    );
    const names = (process.env.GLOBAL_SERVICE_CATEGORIES || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (!names.length) {
      throw new Error(
        'GLOBAL_SERVICE_CATEGORIES must contain a comma-separated category list',
      );
    }

    for (const name of names) {
      const normalizedName = name.toLocaleLowerCase();

      await categoryModel.updateOne(
        { company: null, normalizedName },
        { $set: { name, normalizedName, company: null } },
        { upsert: true, runValidators: true },
      );
    }

    console.log(`Seeded ${names.length} global service categories`);
  } finally {
    await app.close();
  }
}

void seedServiceCategories();
