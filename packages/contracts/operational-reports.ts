export type StockCardBalance={locationId:string;locationName:string;unit:string;opening:string;incoming:string;outgoing:string;closing:string};
export type StockCardSummary={itemId:string;name:string;sku:string;unit:string;balances:StockCardBalance[]};
export type StockCardMovement={sequence:string;before:string;running:string;incoming:string;outgoing:string};
export type ButcheryReportOutput={itemId:string;name:string;sku:string;quantity:string;costShare:string;amount:string;unitCost:string};
export type ButcheryReportDetail={mode:'beef'|'lamb';inputWeight:string;headCount:number|null;carcassWeight:string|null;slaughterLoss:string;cuttingLoss:string;outputWeight:string;inputCost:string;processingCost:string;yieldPercent:string|null;carcassYieldPercent:string|null;cuttingYieldPercent:string|null;outputs:ButcheryReportOutput[]};
export type ButcheryModeSummary={mode:'beef'|'lamb';batches:number;headCount:number;inputWeight:string;carcassWeight:string;slaughterLoss:string;cuttingLoss:string;outputWeight:string;inputCost:string;processingCost:string;totalCost:string;yieldPercent:string|null;carcassYieldPercent:string|null;cuttingYieldPercent:string|null;unitCost:string|null};
