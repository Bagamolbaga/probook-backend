import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ServiceCategoriesService } from './service-categories.service';

const companyId = new Types.ObjectId('66c000000000000000000001');
const otherCompanyId = new Types.ObjectId('66c000000000000000000002');
const categoryId = new Types.ObjectId('66c000000000000000000003');

describe('ServiceCategoriesService', () => {
  const createService = () => {
    const categoryModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: categoryId,
      save: jest.fn().mockResolvedValue({ ...dto, _id: categoryId }),
    }));
    const query = {
      sort: jest.fn(),
      exec: jest.fn(),
    };
    query.sort.mockReturnValue(query);

    Object.assign(categoryModel, {
      find: jest.fn().mockReturnValue(query),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    });

    const companyModel = {
      exists: jest.fn().mockResolvedValue({ _id: companyId }),
    };
    const serviceModel = { exists: jest.fn() };
    const service = new ServiceCategoriesService(
      categoryModel as any,
      companyModel as any,
      serviceModel as any,
    );

    return {
      service,
      categoryModel: categoryModel as any,
      companyModel,
      serviceModel,
      query,
    };
  };

  it('lists only global and requested company categories', async () => {
    const { service, categoryModel, query } = createService();
    query.exec.mockResolvedValue([
      { name: 'Global', company: null },
      { name: 'Local', company: companyId },
    ]);

    const result = await service.getAvailableCategories(companyId.toString());

    expect(result).toHaveLength(2);
    expect(categoryModel.find).toHaveBeenCalledWith({
      $or: [{ company: null }, { company: companyId }],
    });
    expect(query.sort).toHaveBeenCalledWith({ company: 1, name: 1 });
  });

  it('rejects listing categories for a missing company', async () => {
    const { service, companyModel } = createService();
    companyModel.exists.mockResolvedValue(null);

    await expect(
      service.getAvailableCategories(companyId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a category in the company from the route', async () => {
    const { service, categoryModel } = createService();

    await service.createCompanyCategory(companyId.toString(), {
      name: ' Hair ',
      company: otherCompanyId.toString(),
    } as any);

    expect(categoryModel).toHaveBeenCalledWith({
      name: 'Hair',
      normalizedName: 'hair',
      company: companyId,
    });
  });

  it('maps duplicate company category names to conflict', async () => {
    const { service, categoryModel } = createService();
    categoryModel.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));

    await expect(
      service.createCompanyCategory(companyId.toString(), { name: 'Hair' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows equal names in different company scopes', async () => {
    const first = createService();
    const second = createService();

    await first.service.createCompanyCategory(companyId.toString(), {
      name: 'Hair',
    });
    await second.service.createCompanyCategory(otherCompanyId.toString(), {
      name: 'Hair',
    });

    expect(first.categoryModel).toHaveBeenCalledWith(
      expect.objectContaining({ company: companyId }),
    );
    expect(second.categoryModel).toHaveBeenCalledWith(
      expect.objectContaining({ company: otherCompanyId }),
    );
  });

  it('updates only a category owned by the company', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOneAndUpdate.mockResolvedValue({ _id: categoryId });

    await service.updateCompanyCategory(
      companyId.toString(),
      categoryId.toString(),
      { name: ' Nails ' },
    );

    expect(categoryModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: categoryId, company: companyId },
      { $set: { name: 'Nails', normalizedName: 'nails' } },
      { new: true, runValidators: true },
    );
  });

  it('does not update global, foreign, or missing categories', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.updateCompanyCategory(
        companyId.toString(),
        categoryId.toString(),
        { name: 'Nails' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deletion of a category used by a company service', async () => {
    const { service, categoryModel, serviceModel } = createService();
    categoryModel.findOne.mockResolvedValue({ _id: categoryId });
    serviceModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(
      service.deleteCompanyCategory(
        companyId.toString(),
        categoryId.toString(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(categoryModel.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('deletes an unused category owned by the company', async () => {
    const { service, categoryModel, serviceModel } = createService();
    const category = { _id: categoryId, company: companyId };
    categoryModel.findOne.mockResolvedValue(category);
    categoryModel.findOneAndDelete.mockResolvedValue(category);
    serviceModel.exists.mockResolvedValue(null);

    const result = await service.deleteCompanyCategory(
      companyId.toString(),
      categoryId.toString(),
    );

    expect(result).toBe(category);
    expect(categoryModel.findOneAndDelete).toHaveBeenCalledWith({
      _id: categoryId,
      company: companyId,
    });
  });

  it('does not delete global, foreign, or missing categories', async () => {
    const { service, categoryModel, serviceModel } = createService();
    categoryModel.findOne.mockResolvedValue(null);

    await expect(
      service.deleteCompanyCategory(
        companyId.toString(),
        categoryId.toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(serviceModel.exists).not.toHaveBeenCalled();
    expect(categoryModel.findOneAndDelete).not.toHaveBeenCalled();
  });
});
