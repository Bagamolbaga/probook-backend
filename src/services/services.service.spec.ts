import { Types } from 'mongoose';
import { UserRole } from '../user/schema/user.schema';
import { ServiceService } from './services.service';

const companyId = new Types.ObjectId('66b000000000000000000001');
const serviceId = new Types.ObjectId('66b000000000000000000002');
const specialist1Id = new Types.ObjectId('66b000000000000000000003');
const specialist2Id = new Types.ObjectId('66b000000000000000000004');
const globalCategoryId = new Types.ObjectId('66b000000000000000000005');
const companyCategoryId = new Types.ObjectId('66b000000000000000000006');
const otherCategoryId = new Types.ObjectId('66b000000000000000000007');

describe('ServiceService specialist synchronization', () => {
  const createService = () => {
    const savedService = {
      _id: serviceId,
      company: companyId,
      specialists: [specialist1Id],
    };

    const serviceModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: serviceId,
      save: jest.fn().mockResolvedValue({
        ...savedService,
        ...dto,
      }),
    }));

    Object.assign(serviceModel, {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    });

    const specialistModel = {
      updateMany: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    const categoryModel = {
      findOne: jest.fn(),
    };
    const service = new ServiceService(
      serviceModel as any,
      specialistModel as any,
      categoryModel as any,
    );

    return {
      service,
      serviceModel: serviceModel as any,
      specialistModel,
      categoryModel,
    };
  };

  it('adds a newly created service to assigned specialists', async () => {
    const { service, specialistModel, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue({
      _id: globalCategoryId,
      company: null,
    });

    const result = await service.createService({
      companyId: companyId.toString(),
      categoryId: globalCategoryId.toString(),
      name: 'Haircut',
      specialistIds: [specialist1Id.toString(), specialist2Id.toString()],
    });

    expect(result.specialists).toEqual([specialist1Id, specialist2Id]);
    expect(specialistModel.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [specialist1Id, specialist2Id] },
        company: companyId,
        role: UserRole.SPECIALIST,
      },
      { $addToSet: { services: serviceId } },
    );
    expect(result.category).toEqual(globalCategoryId);
  });

  it('creates a service with a category owned by the company', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue({
      _id: companyCategoryId,
      company: companyId,
    });

    const result = await service.createService({
      companyId: companyId.toString(),
      categoryId: companyCategoryId.toString(),
      name: 'Haircut',
    });

    expect(result.category).toEqual(companyCategoryId);
    expect(categoryModel.findOne).toHaveBeenCalledWith({
      _id: companyCategoryId,
      $or: [{ company: null }, { company: companyId }],
    });
  });

  it('keeps the legacy specialists request field working', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue({
      _id: globalCategoryId,
      company: null,
    });

    const result = await service.createService({
      companyId: companyId.toString(),
      categoryId: globalCategoryId.toString(),
      specialists: [{ _id: specialist1Id }],
    });

    expect(result.specialists).toEqual([specialist1Id]);
  });

  it('rejects a category that is unavailable to the company', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue(null);

    await expect(
      service.createService({
        companyId: companyId.toString(),
        categoryId: otherCategoryId.toString(),
        name: 'Haircut',
      }),
    ).rejects.toThrow('Category is not available for this company');
  });

  it('rejects service creation without a category id', async () => {
    const { service } = createService();

    await expect(
      service.createService({
        companyId: companyId.toString(),
        name: 'Haircut',
      } as any),
    ).rejects.toThrow('Category is not available for this company');
  });

  it('syncs specialist services when service assignments change', async () => {
    const { service, serviceModel, specialistModel } = createService();
    serviceModel.findOne.mockResolvedValue({
      _id: serviceId,
      company: companyId,
      specialists: [specialist1Id],
    });
    serviceModel.findOneAndUpdate.mockResolvedValue({
      _id: serviceId,
      company: companyId,
      specialists: [specialist2Id],
    });

    await service.updateService({
      companyId: companyId.toString(),
      serviceId: serviceId.toString(),
      data: {
        specialistIds: [specialist2Id.toString()],
      },
    });

    expect(serviceModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: serviceId.toString(),
        company: companyId,
      },
      { $set: { specialists: [specialist2Id] } },
      { new: true },
    );
    expect(specialistModel.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [specialist2Id] },
        company: companyId,
        role: UserRole.SPECIALIST,
      },
      { $addToSet: { services: serviceId } },
    );
    expect(specialistModel.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        _id: { $in: [specialist1Id] },
        company: companyId,
        role: UserRole.SPECIALIST,
      },
      { $pull: { services: serviceId } },
    );
  });

  it('updates a service to an available category', async () => {
    const { service, serviceModel, categoryModel } = createService();
    serviceModel.findOne.mockResolvedValue({
      _id: serviceId,
      company: companyId,
      specialists: [],
    });
    serviceModel.findOneAndUpdate.mockResolvedValue({
      _id: serviceId,
      category: globalCategoryId,
    });
    categoryModel.findOne.mockResolvedValue({
      _id: globalCategoryId,
      company: null,
    });

    await service.updateService({
      companyId: companyId.toString(),
      serviceId: serviceId.toString(),
      data: { categoryId: globalCategoryId.toString() },
    });

    expect(serviceModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: serviceId.toString(), company: companyId },
      { $set: { category: globalCategoryId } },
      { new: true },
    );
  });

  it('rejects updating a service to another company category', async () => {
    const { service, serviceModel, categoryModel } = createService();
    serviceModel.findOne.mockResolvedValue({
      _id: serviceId,
      company: companyId,
      specialists: [],
    });
    categoryModel.findOne.mockResolvedValue(null);

    await expect(
      service.updateService({
        companyId: companyId.toString(),
        serviceId: serviceId.toString(),
        data: { categoryId: otherCategoryId.toString() },
      }),
    ).rejects.toThrow('Category is not available for this company');
  });

  it('removes deleted services from specialists', async () => {
    const { service, serviceModel, specialistModel } = createService();
    serviceModel.findOneAndDelete.mockResolvedValue({
      _id: serviceId,
      company: companyId,
    });

    await service.deleteServiceBy({ id: serviceId as any });

    expect(specialistModel.updateMany).toHaveBeenCalledWith(
      { services: serviceId },
      { $pull: { services: serviceId } },
    );
  });
});
