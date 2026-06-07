import { Test, TestingModule } from '@nestjs/testing';
import { SiriService } from './siri.service';

describe('SiriService', () => {
  let service: SiriService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SiriService],
    }).compile();

    service = module.get<SiriService>(SiriService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
