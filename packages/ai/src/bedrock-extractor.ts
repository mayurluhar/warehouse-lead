import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { ExtractedLeadData } from '@warehouse-lead/core';
import { extractWithHeuristics } from './heuristic-extractor';

export class BedrockLeadExtractor {
  private client: BedrockRuntimeClient | null = null;
  private modelId: string;
  private region: string;

  constructor() {
    this.region = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1';
    this.modelId = process.env.DEFAULT_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    
    try {
      this.client = new BedrockRuntimeClient({ region: this.region });
    } catch (err) {
      console.warn('Failed to initialize Bedrock client, will use heuristic fallback:', err);
      this.client = null;
    }
  }

  public async extract(title: string, text: string): Promise<ExtractedLeadData> {
    const fullText = `${title}\n\n${text}`;

    if (this.client) {
      try {
        const result = await this.extractWithBedrockConverse(fullText);
        if (result) {
          return {
            ...result,
            modelUsed: `bedrock:${this.modelId}`
          };
        }
      } catch (err) {
        console.warn(`[Bedrock Ingestion] Bedrock invocation returned error: ${(err as Error).message}. Falling back to Rule-based NLP extraction.`);
      }
    }

    // Graceful NLP fallback
    const heuristicResult = extractWithHeuristics(title, text);
    return {
      ...heuristicResult,
      modelUsed: 'nlp-heuristic-fallback'
    };
  }

  private async extractWithBedrockConverse(documentText: string): Promise<ExtractedLeadData | null> {
    if (!this.client) return null;

    const systemPrompt = `You are an expert Warehouse Lead Intelligence extraction system.
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

    const command = new ConverseCommand({
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
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

    // Parse JSON
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedLeadData;
    }

    return null;
  }
}
