import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { getLogger } from '../../../common/Logger';
import { ILeadRepository } from '../ports/ILeadRepository';
import { IIngestionMetricsRepository } from '../ports/IIngestionMetricsRepository';

const logger = getLogger('ClearLeadsUseCase');

/**
 * Wipes the tenant's leads and ingestion counters.
 *
 * A development convenience for re-running scans from a clean slate. It has no
 * confirmation step and no audit record, so it needs a destructive-action
 * permission once the authorization model exists.
 */
export class ClearLeadsUseCase extends UseCase<void, void> {
  private readonly leadRepository: ILeadRepository;
  private readonly metricsRepository: IIngestionMetricsRepository;

  constructor(deps: {
    leadRepository: ILeadRepository;
    metricsRepository: IIngestionMetricsRepository;
  }) {
    super();
    this.leadRepository = deps.leadRepository;
    this.metricsRepository = deps.metricsRepository;
  }

  protected async handle(_input: void, context: RequestContext): Promise<void> {
    await this.leadRepository.deleteAll(context.tenantId);
    await this.metricsRepository.reset(context.tenantId);

    logger.warn('All leads and ingestion metrics cleared', { tenantId: context.tenantId });
  }
}
