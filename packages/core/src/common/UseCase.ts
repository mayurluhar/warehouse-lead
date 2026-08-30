import { RequestContext, assertTenantAccess } from './RequestContext';

/**
 * Base class for every application workflow.
 *
 * `execute` runs the authn/authz pipeline and then delegates to `handle`,
 * which subclasses implement. Keeping the guards in `execute` means a use case
 * cannot forget to run them, and adding a new guard later is a single edit here
 * rather than an edit in every use case.
 *
 * The blueprint's permission guards (assertAuthenticated, assertPermission and
 * a Permission enum) are deliberately absent: this platform has no auth model
 * yet, and inventing one would mean guessing at roles the product has not
 * defined. Only the tenant guard is wired, and it is fail-closed.
 */
export abstract class UseCase<TInput, TOutput> {
  /** Set false for workflows that may run without a tenant (none today). */
  readonly requireTenantAccess: boolean = true;

  protected abstract handle(input: TInput, context: RequestContext): Promise<TOutput>;

  async execute(input: TInput, context: RequestContext): Promise<TOutput> {
    if (this.requireTenantAccess) {
      assertTenantAccess(context);
    }
    return this.handle(input, context);
  }
}
