import { getModelToken } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { ServiceCategory } from '../service-categories/schema/service-category.schema';
import { Service } from '../services/schema/services.schema';

async function migrateServiceCategories() {
  const fallbackName = process.env.SERVICE_CATEGORY_FALLBACK_NAME?.trim();

  if (!fallbackName) {
    throw new Error('SERVICE_CATEGORY_FALLBACK_NAME must be set explicitly');
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const categoryModel = app.get<Model<ServiceCategory>>(
      getModelToken(ServiceCategory.name),
      { strict: false },
    );
    const serviceModel = app.get<Model<Service>>(getModelToken(Service.name), {
      strict: false,
    });
    const normalizedName = fallbackName.toLocaleLowerCase();
    const fallbackCategory = await categoryModel.findOneAndUpdate(
      { company: null, normalizedName },
      {
        $set: {
          name: fallbackName,
          normalizedName,
          company: null,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    const result = await serviceModel.updateMany(
      {
        $or: [{ category: { $exists: false } }, { category: null }],
      },
      { $set: { category: fallbackCategory._id } },
    );
    const remaining = await serviceModel.countDocuments({
      $or: [{ category: { $exists: false } }, { category: null }],
    });

    if (remaining > 0) {
      throw new Error(`${remaining} services still have no category`);
    }

    console.log(`Migrated ${result.modifiedCount} services`);
  } finally {
    await app.close();
  }
}

void migrateServiceCategories();
