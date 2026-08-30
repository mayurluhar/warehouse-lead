import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../../common/Logger';
import { ExtractedLead } from '../../domains/lead/entities/Lead';
import { ILeadExtractor } from '../../domains/lead/ports/ILeadExtractor';

const logger = getLogger('BedrockLeadExtractor');

const SYSTEM_PROMPT = `You are an expert Warehouse Lead Intelligence extraction system.
Your task is to analyze documents, tenders, RFPs, news articles, and trade newsletters to extract structured occupier warehouse space requirements.

Strict Extraction Rules:
1. isRelevant: true ONLY if there is an occupier or government body expressing a requirement, tender, RFP, expansion, or scouting for warehouse/godown/logistics space. Set false for general market articles, stock reports, or residential real estate.
2. intent: one of 'tender', 'rfp', 'scouting', 'expansion', 'land', 'watch'.
3. requirementType: one of 'lease', 'hire', 'build_to_suit', 'buy', 'land', 'unknown'.
4. size: extract value and unit ('sqft', 'lakh_sqft', 'acres', 'sqm'). Normalize lakh sqft (1 lakh = 100,000 sqft) and acres (1 acre = 43,560 sqft).
5. location: state, city, micro-corridor (e.g. Sanand, Changodar, Aslali, Bhiwandi, Dahej, Hazira, etc.), and rawText.
6. specialRequirements: array of tags like 'cold_storage', 'bonded', 'grade_a', 'hazmat', 'fm2_floor'.
7. evidence: Provide an array of exact quotes from the text for every key field extracted: size, location, organization, specialRequirements, deadline.
8. NEVER invent missing details. Output null explicitly for unstated fields.

Return ONLY a valid JSON object strictly adhering to this schema:
{
  "isRelevant": boolean,
  "organizationName": string | null,
  "industry": string | null,
  "intent": "tender" | "rfp" | "scouting" | "expansion" | "land" | "watch",
  "requirementType": "lease" | "hire" | "build_to_suit" | "buy" | "land" | "unknown",
  "size": {
    "value": number | null,
    "unit": "sqft" | "acres" | "lakh_sqft" | "sqm" | null,
    "normalizedSqft": number | null
  },
  "location": {
    "state": string | null,
    "city": string | null,
    "corridor": string | null,
    "rawText": string | null
  },
  "specialRequirements": string[],
  "deadline": string | null,
  "leaseTermMonths": number | null,
  "contact": {
    "name": string | null,
    "role": string | null,
    "organization": string | null,
    "email": string | null,
    "phone": string | null
  },
  "tenderReference": string | null,
  "evidence": [
    { "field": string, "quote": string }
  ],
  "reasoningSummary": string
}`;

/**
 * Amazon Bedrock structured extraction, with a rule-based fallback.
 *
 * The fallback is injected as an ILeadExtractor rather than imported directly,
 * which keeps this adapter honest: it depends on the Port, not on a specific
 * fallback implementation, and a test can substitute a stub that makes no
 * network calls.
 *
 * Bedrock failure is never fatal. Extraction degrades to the heuristic path so
 * a Bedrock outage, a throttle or missing model access slows quality rather
 * than stopping ingestion entirely.
 */
export class BedrockLeadExtractor implements ILeadExtractor {
  public readonly extractorName = 'bedrock';

  private readonly client: BedrockRuntimeClient | null;
  private readonly modelId: string;
  private readonly region: string;
  private readonly fallback: ILeadExtractor;

  constructor(deps: { fallback: ILeadExtractor; region?: string; modelId?: string }) {
    this.fallback = deps.fallback;
    this.region = deps.region || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
    this.modelId = deps.modelId || process.env.DEFAULT_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    let client: BedrockRuntimeClient | null = null;
    try {
      client = new BedrockRuntimeClient({ region: this.region });
    } catch (error) {
      logger.warn('Bedrock client construction failed; extraction will use the fallback', {
        region: this.region,
        error: (error as Error).message
      });
    }
    this.client = client;
  }

  public async extract(title: string, text: string): Promise<ExtractedLead> {
    if (this.client) {
      try {
        const result = await this.invokeConverse(`${title}\n\n${text}`);
        if (result) {
          return { ...result, modelUsed: `bedrock:${this.modelId}` };
        }
        logger.warn('Bedrock returned no parsable JSON; using fallback', { modelId: this.modelId });
      } catch (error) {
        logger.warn('Bedrock invocation failed; using fallback', {
          modelId: this.modelId,
          error: (error as Error).message
        });
      }
    }

    return this.fallback.extract(title, text);
  }

  private async invokeConverse(documentText: string): Promise<ExtractedLead | null> {
    if (!this.client) return null;

    const command = new ConverseCommand({
      modelId: this.modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [{ text: `Extract warehouse requirement intelligence from this document:\n\n${documentText}` }]
        }
      ],
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1
      }
    });

    const response = await this.client.send(command);
    const textOutput = response.output?.message?.content?.[0]?.text;
    if (!textOutput) return null;

    // The model is asked for bare JSON but may wrap it in prose or a fence.
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ExtractedLead;
  }
}
