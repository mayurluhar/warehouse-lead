import { RequestContext } from '../../../common/RequestContext';
import { UseCase } from '../../../common/UseCase';
import { Lead } from '../entities/Lead';
import { ILeadRepository } from '../ports/ILeadRepository';

export interface GetLeadInput {
  id: string;
}

/**
 * Loads one lead with its full evidence trail.
 *
 * Throws rather than returning null so the handler's error mapping turns it
 * into a 404 without the handler needing to know the domain rule.
 */
export class GetLeadUseCase extends UseCase<GetLeadInput, Lead> {
  private readonly leadRepository: ILeadRepository;

  constructor(deps: { leadRepository: ILeadRepository }) {
    super();
    this.leadRepository = deps.leadRepository;
  }

  protected async handle(input: GetLeadInput, context: RequestContext): Promise<Lead> {
    const lead = await this.leadRepository.findById(input.id, context.tenantId);
    if (!lead) {
      throw new Error(`Lead not found: ${input.id}`);
    }
    return lead;
  }
}
