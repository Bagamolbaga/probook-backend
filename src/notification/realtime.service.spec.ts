import { NotificationGateway } from './notification.gateway';
import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('publishes company data updates to the company room', () => {
    // The unit exercises only the gateway collaboration.
    const gateway = {
      sendCompanyDataUpdated: jest.fn(),
      addUserToCompany: jest.fn(),
    } as unknown as NotificationGateway;
    const service = new RealtimeService(gateway);

    const event = service.publishCompanyDataUpdated('company-id', 'shifts');

    expect(event).toEqual({
      id: expect.any(String),
      companyId: 'company-id',
      entity: 'shifts',
      occurredAt: expect.any(String),
    });
    expect(gateway.sendCompanyDataUpdated).toHaveBeenCalledWith(
      'company-id',
      event,
    );
  });

  it('joins existing user sockets to a newly activated company', async () => {
    // The unit exercises only the gateway collaboration.
    const gateway = {
      sendCompanyDataUpdated: jest.fn(),
      addUserToCompany: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationGateway;
    const service = new RealtimeService(gateway);

    await service.addUserToCompany('user-id', 'company-id');

    expect(gateway.addUserToCompany).toHaveBeenCalledWith(
      'user-id',
      'company-id',
    );
  });
});
