import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { Lead, LeadFilterOptions } from '../entities/Lead';
import { ILeadRepository } from '../ports/ILeadRepository';

export interface ListLeadsOutput {
  count: number;
  leads: Lead[];
}

/** Returns the tenant's lead inbox, filtered and sorted. */
export class ListLeadsUseCase extends UseCase<LeadFilterOptions, ListLeadsOutput> {
  private readonly leadRepository: ILeadRepository;

  constructor(deps: { leadRepository: ILeadRepository }) {
    super();
    this.leadRepository = deps.leadRepository;
  }

  protected async handle(input: LeadFilterOptions, context: RequestContext): Promise<ListLeadsOutput> {
    const leads = await this.leadRepository.findMany(input ?? {}, context.tenantId);
    return { count: leads.length, leads };
  }
}
