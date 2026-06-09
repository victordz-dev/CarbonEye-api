import { Test, TestingModule } from '@nestjs/testing';
import { SiriService } from './siri.service';
import { GeoService } from '../geo/geo.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { SIRI_CONSTANTS } from './siri.constants';

describe('SiriService', () => {
  let service: SiriService;
  let geoService: jest.Mocked<GeoService>;
  let integrationsService: jest.Mocked<IntegrationsService>;

  beforeEach(async () => {
    // Cria mocks para os serviços
    const mockGeoService = {
      obterQuantidadeFocosNoEntorno: jest.fn(),
    };
    const mockIntegrationsService = {
      obterHistoricoNdvi: jest.fn(),
      obterIndicesRecentes: jest.fn(),
      obterClimaAtual: jest.fn(),
      obterDadosSolo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiriService,
        { provide: GeoService, useValue: mockGeoService },
        { provide: IntegrationsService, useValue: mockIntegrationsService },
      ],
    }).compile();

    service = module.get<SiriService>(SiriService);
    geoService = module.get(GeoService) as jest.Mocked<GeoService>;
    integrationsService = module.get(
      IntegrationsService,
    ) as jest.Mocked<IntegrationsService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calcularSiri', () => {
    const defaultCoords = [
      { latitude: -10, longitude: -50 },
      { latitude: -10, longitude: -51 },
      { latitude: -11, longitude: -51 },
    ];
    const polyId = 'test-poly';

    it('deve calcular a nota máxima (100) para condições ideais', async () => {
      // Setup mocks
      integrationsService.obterHistoricoNdvi.mockResolvedValue([
        { dataUnix: 1, valor: 0.6 },
        { dataUnix: 2, valor: 0.6 },
        { dataUnix: 3, valor: 0.6 },
        { dataUnix: 4, valor: 0.8 },
        { dataUnix: 5, valor: 0.8 },
        { dataUnix: 6, valor: 0.85 }, // Crescimento alto (> 10%) e ótimo (> 0.8)
      ]);
      integrationsService.obterIndicesRecentes.mockResolvedValue({
        evi: 0.8,
        ndwi: 0.2, // Sem penalidade
      });
      geoService.obterQuantidadeFocosNoEntorno.mockResolvedValue(
        SIRI_CONSTANTS.INCENDIOS_NENHUM,
      );
      integrationsService.obterClimaAtual.mockResolvedValue({
        temp: 25,
        umidade: 60, // Ideal
        vento: 10, // Ideal
      });
      integrationsService.obterDadosSolo.mockResolvedValue({
        tempSuperficie: 25,
        umidade: 0.2, // Ideal
      });

      const result = await service.calcularSiri(defaultCoords, polyId);

      expect(result.pontuacaoTotal).toBe(100);
      expect(result.classificacao).toBe(
        'Área com Baixo Risco Ambiental (Potencialmente Classificável)',
      );
      expect(result.detalhes.vegetacao).toBe(45);
      expect(result.detalhes.historico).toBe(30);
      expect(result.detalhes.incendios).toBe(20);
      expect(result.detalhes.clima).toBe(5);
    });

    it('deve calcular a nota e aplicar penalidade de área severamente degradada', async () => {
      // Setup mocks
      integrationsService.obterHistoricoNdvi.mockResolvedValue([
        { dataUnix: 1, valor: 0.2 },
        { dataUnix: 2, valor: 0.2 },
        { dataUnix: 3, valor: 0.2 },
        { dataUnix: 4, valor: 0.1 },
        { dataUnix: 5, valor: 0.1 },
        { dataUnix: 6, valor: 0.1 }, // Degradado (< 0.25)
      ]);
      integrationsService.obterIndicesRecentes.mockResolvedValue({
        evi: 0.1,
        ndwi: -0.2, // Estresse hídrico
      });
      geoService.obterQuantidadeFocosNoEntorno.mockResolvedValue(
        SIRI_CONSTANTS.INCENDIOS_ALTO + 5, // Muitos focos
      );
      integrationsService.obterClimaAtual.mockResolvedValue({
        temp: 40, // Muito quente
        umidade: 10, // Muito seco
        vento: 35, // Muito vento
      });
      integrationsService.obterDadosSolo.mockResolvedValue({
        tempSuperficie: 45,
        umidade: 0.02, // Solo seco
      });

      const result = await service.calcularSiri(defaultCoords, polyId);

      // Apesar de tudo dar 0, o limite máximo (se ganhasse algum ponto) é 35 pela penalidade.
      // Nesse caso específico as pontuações individuais também devem dar 0.
      expect(result.pontuacaoTotal).toBe(0);
      expect(result.classificacao).toBe('Área Sob Risco Ambiental');
      expect(result.detalhes.vegetacao).toBe(0);
    });
  });
});
