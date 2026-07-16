"""Apply agentic/predictive commerce schema expansion."""
from pathlib import Path

SCHEMA = Path("packages/database/prisma/schema.prisma")
MIG_DIR = Path("packages/database/prisma/migrations/20260716140000_agentic_intelligence_expansion")

text = SCHEMA.read_text(encoding="utf-8")
if "model DiscoverabilityScore" in text:
    print("Schema already expanded")
else:
    old_org = """  predictionOutcomes     PredictionOutcome[]
  modelVersions          ModelVersion[]

  @@map("organizations")
}"""
    new_org = """  predictionOutcomes     PredictionOutcome[]
  modelVersions          ModelVersion[]
  productVariants        ProductVariant[]
  productMedia           ProductMedia[]
  productIdentifiers     ProductIdentifier[]
  externalPayloads       ExternalPayload[]
  discoverabilityScores  DiscoverabilityScore[]
  graphEdges             GraphEdge[]
  priceObservations      PriceObservation[]
  priceRecommendations   PriceRecommendation[]
  portfolioRiskSnapshots PortfolioRiskSnapshot[]
  riskLimits             RiskLimit[]
  riskAlerts             RiskAlert[]
  agentDefinitions       AgentDefinition[]
  agentRuns              AgentRun[]
  agentActions           AgentAction[]
  agentAuthorizations    AgentAuthorization[]
  agentTransactions      AgentTransaction[]
  supplierScorecards     SupplierScorecard[]
  rfqRequests            RfqRequest[]
  landedCostAssessments  LandedCostAssessment[]
  complianceAssessments  ComplianceAssessment[]
  trendObservations      TrendObservation[]
  trendScores            TrendScore[]
  experiments            Experiment[]
  catalogValidations     CatalogValidation[]
  shadowDecisions        ShadowDecision[]
  agentCarts             AgentCart[]
  consentRecords         ConsentRecord[]
  connectorHealthEvents  ConnectorHealthEvent[]
  webhookReceipts        WebhookReceipt[]
  deadLetterItems        DeadLetterItem[]
  liveFeedRegistries     LiveFeedRegistry[]
  commerceEvents         CommerceEvent[]
  workflowDefinitions    WorkflowDefinition[]
  workflowRuns           WorkflowRun[]
  reconciliationConflicts ReconciliationConflict[]

  @@map("organizations")
}"""
    if old_org not in text:
        raise SystemExit("Organization block not found")
    text = text.replace(old_org, new_org, 1)

    old_product = """  schemaVersion       String   @default("1") @map("schema_version") @db.VarChar(16)
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt           DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization           Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  offers                 SupplierOffer[]
  listings               Listing[]
  opportunities          Opportunity[]
  signals                CommerceSignal[]
  forecasts              DemandForecast[]
  policyAssessments      PolicyAssessment[]
  orderLines             CustomerOrderLine[]
  supplierPurchaseOrders SupplierPurchaseOrder[]
  simulationRuns         SimulationRun[]
  profitabilitySnapshots ProfitabilitySnapshot[]
  predictionOutcomes     PredictionOutcome[]

  @@unique([organizationId, sourcePlatform, externalId])
  @@index([organizationId])
  @@map("products")
}"""

    new_product = """  schemaVersion       String   @default("1") @map("schema_version") @db.VarChar(16)
  brand               String?  @db.VarChar(200)
  manufacturer        String?  @db.VarChar(200)
  condition           String?  @db.VarChar(64)
  countryOfOrigin     String?  @map("country_of_origin") @db.VarChar(2)
  hsCode              String?  @map("hs_code") @db.VarChar(16)
  sourceProvenance    String?  @map("source_provenance") @db.VarChar(128)
  rawPayloadRef       String?  @map("raw_payload_ref") @db.VarChar(128)
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt           DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  organization           Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  offers                 SupplierOffer[]
  listings               Listing[]
  opportunities          Opportunity[]
  signals                CommerceSignal[]
  forecasts              DemandForecast[]
  policyAssessments      PolicyAssessment[]
  orderLines             CustomerOrderLine[]
  supplierPurchaseOrders SupplierPurchaseOrder[]
  simulationRuns         SimulationRun[]
  profitabilitySnapshots ProfitabilitySnapshot[]
  predictionOutcomes     PredictionOutcome[]
  variants               ProductVariant[]
  media                  ProductMedia[]
  identifiers            ProductIdentifier[]
  discoverabilityScores  DiscoverabilityScore[]
  priceObservations      PriceObservation[]
  priceRecommendations   PriceRecommendation[]
  landedCostAssessments  LandedCostAssessment[]
  complianceAssessments  ComplianceAssessment[]
  trendScores            TrendScore[]
  catalogValidations     CatalogValidation[]
  shadowDecisions        ShadowDecision[]
  graphEdgesFrom         GraphEdge[]             @relation("GraphFromProduct")
  graphEdgesTo           GraphEdge[]             @relation("GraphToProduct")

  @@unique([organizationId, sourcePlatform, externalId])
  @@index([organizationId])
  @@map("products")
}"""
    if old_product not in text if False else True:
        pass

print("use fixed complete script below")
"
