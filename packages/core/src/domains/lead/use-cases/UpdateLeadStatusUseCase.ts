import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { getLogger } from '../../../common/Logger';
import { Lead, LeadStatus } from '../entities/Lead';
import { ILeadRepository } from '../ports/ILeadRepository';

const logger = getLogger('UpdateLeadStatusUseCase');

const VALID_STATUSES: LeadStatus[] = ['inbox', 'approved', 'contacted', 'rejected'];

export interface UpdateLeadStatusInput {
  id: string;
  status: LeadStatus;
}

/**
 * Moves a lead through the review workflow: inbox → approved → contacted, or
 * rejected.
 */
export class UpdateLeadStatusUseCase extends UseCase<UpdateLeadStatusInput, Lead> {
  private readonly leadRepository: ILeadRepository;

  constructor(deps: { leadRepository: ILeadRepository }) {
    super();
    this.leadRepository = deps.leadRepository;
  }

  protected async handle(input: UpdateLeadStatusInput, context: RequestContext): Promise<Lead> {
    if (!VALID_STATUSES.includes(input.status)) {
      throw new Error(`Validation failed: status must be one of ${VALID_STATUSES.join(', ')}`);
    }

    const updated = await this.leadRepository.updateStatus(input.id, input.status, context.tenantId);
    if (!updated) {
      throw new Error(`Lead not found: ${input.id}`);
    }

    logger.info('Lead status updated', {
      tenantId: context.tenantId,
      leadId: input.id,
      status: input.status
    });

    return updated;
  }
}
