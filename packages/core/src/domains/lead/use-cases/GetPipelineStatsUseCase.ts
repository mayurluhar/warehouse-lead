import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { PipelineStats } from '../entities/IngestionMetrics';
import { ILeadRepository } from '../ports/ILeadRepository';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';
import { PipelineStatsService } from '../services/PipelineStatsService';

/** Builds the dashboard rollup from stored leads and the ingestion counters. */
export class GetPipelineStatsUseCase extends UseCase<void, PipelineStats> {
  private readonly leadRepository: ILeadRepository;
  private readonly metricsRepository: IIngestionMetricsRepository;
  private readonly statsService: PipelineStatsService;

  constructor(deps: {
    leadRepository: ILeadRepository;
    metricsRepository: IIngestionMetricsRepository;
    statsService: PipelineStatsService;
  }) {
    super();
    this.leadRepository = deps.leadRepository;
    this.metricsRepository = deps.metricsRepository;
    this.statsService = deps.statsService;
  }

  protected async handle(_input: void, context: RequestContext): Promise<PipelineStats> {
    const [leads, metrics] = await Promise.all([
      this.leadRepository.findMany({}, context.tenantId),
      this.metricsRepository.get(context.tenantId)
    ]);

    return this.statsService.calculate(leads, metrics);
  }
}
