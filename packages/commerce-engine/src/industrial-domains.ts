/**
 * Industrial commerce verticals — same platform as retail, industry-specific taxonomies.
 */

export const INDUSTRIAL_VERTICALS = [
  'automotive_parts',
  'heavy_equipment',
  'industrial_machinery',
  'construction',
  'manufacturing',
  'aerospace',
  'marine',
  'agriculture',
  'mining',
  'oil_gas',
  'electrical',
  'hvac',
  'hydraulics',
  'robotics',
  'automation',
  'medical_equipment',
  'laboratory_equipment',
  'industrial_iot',
  'safety_equipment',
  'warehousing',
  'packaging',
] as const;

export type IndustrialVertical = (typeof INDUSTRIAL_VERTICALS)[number];

export type IndustrialVerticalDescriptor = {
  id: IndustrialVertical;
  label: string;
  typicalBuyers: string[];
  keyAttributes: string[];
  documentTypes: string[];
};

export const INDUSTRIAL_VERTICAL_CATALOG: IndustrialVerticalDescriptor[] = [
  {
    id: 'automotive_parts',
    label: 'Automotive Parts',
    typicalBuyers: ['OEM service', 'fleet', 'aftermarket'],
    keyAttributes: ['oemPartNumber', 'fitment', 'vehicleApplications'],
    documentTypes: ['fitment_guide', 'warranty', 'sds'],
  },
  {
    id: 'heavy_equipment',
    label: 'Heavy Equipment',
    typicalBuyers: ['contractors', 'rental fleets', 'mines'],
    keyAttributes: ['serialCompatibility', 'operatingHours', 'hydraulicSpecs'],
    documentTypes: ['service_manual', 'parts_catalog', 'cad'],
  },
  {
    id: 'industrial_machinery',
    label: 'Industrial Machinery',
    typicalBuyers: ['plants', 'OEM', 'integrators'],
    keyAttributes: ['powerRating', 'throughput', 'controlInterface'],
    documentTypes: ['manual', 'electrical_schematic', 'spare_parts'],
  },
  {
    id: 'construction',
    label: 'Construction',
    typicalBuyers: ['GCs', 'subs', 'suppliers'],
    keyAttributes: ['loadRating', 'grade', 'siteCerts'],
    documentTypes: ['spec_sheet', 'safety', 'msds'],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    typicalBuyers: ['procurement', 'production', 'MRO'],
    keyAttributes: ['bomRole', 'tolerance', 'material'],
    documentTypes: ['drawing', 'bom', 'inspection'],
  },
  {
    id: 'aerospace',
    label: 'Aerospace',
    typicalBuyers: ['MRO', 'OEM', 'airlines'],
    keyAttributes: ['ataChapter', 'traceability', 'airworthiness'],
    documentTypes: ['coa', 'trace', 'sds'],
  },
  {
    id: 'marine',
    label: 'Marine',
    typicalBuyers: ['shipyards', 'operators'],
    keyAttributes: ['classSociety', 'saltwaterRating'],
    documentTypes: ['type_approval', 'manual'],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    typicalBuyers: ['dealers', 'farms', 'co-ops'],
    keyAttributes: ['equipmentModel', 'seasonality'],
    documentTypes: ['parts_book', 'safety'],
  },
  {
    id: 'mining',
    label: 'Mining',
    typicalBuyers: ['mines', 'contractors'],
    keyAttributes: ['dutyCycle', 'abrasionClass'],
    documentTypes: ['service_manual', 'sds'],
  },
  {
    id: 'oil_gas',
    label: 'Oil & Gas',
    typicalBuyers: ['operators', 'EPC'],
    keyAttributes: ['pressureClass', 'nace', 'hazardZone'],
    documentTypes: ['datasheet', 'hazmat', 'sds'],
  },
  {
    id: 'electrical',
    label: 'Electrical',
    typicalBuyers: ['contractors', 'utilities', 'OEMs'],
    keyAttributes: ['voltage', 'amperage', 'ipRating'],
    documentTypes: ['datasheet', 'ul_listing', 'sds'],
  },
  {
    id: 'hvac',
    label: 'HVAC',
    typicalBuyers: ['contractors', 'facility'],
    keyAttributes: ['btu', 'seer', 'refrigerant'],
    documentTypes: ['install_guide', 'sds'],
  },
  {
    id: 'hydraulics',
    label: 'Hydraulics',
    typicalBuyers: ['OEM', 'MRO'],
    keyAttributes: ['pressurePsi', 'flowGpm', 'portSize'],
    documentTypes: ['datasheet', 'cad'],
  },
  {
    id: 'robotics',
    label: 'Robotics',
    typicalBuyers: ['integrators', 'factories'],
    keyAttributes: ['payload', 'reach', 'controller'],
    documentTypes: ['sdk', 'manual', 'cad'],
  },
  {
    id: 'automation',
    label: 'Automation',
    typicalBuyers: ['controls', 'OEMs'],
    keyAttributes: ['protocol', 'ioCount', 'plcFamily'],
    documentTypes: ['wiring', 'firmware', 'manual'],
  },
  {
    id: 'medical_equipment',
    label: 'Medical Equipment',
    typicalBuyers: ['hospitals', 'distributors'],
    keyAttributes: ['fdaClass', 'udi', 'sterility'],
    documentTypes: ['ifu', '510k', 'sds'],
  },
  {
    id: 'laboratory_equipment',
    label: 'Laboratory Equipment',
    typicalBuyers: ['labs', 'universities'],
    keyAttributes: ['accuracy', 'range', 'calibration'],
    documentTypes: ['manual', 'calibration', 'sds'],
  },
  {
    id: 'industrial_iot',
    label: 'Industrial IoT',
    typicalBuyers: ['OT teams', 'integrators'],
    keyAttributes: ['protocol', 'sensorType', 'edgeCompute'],
    documentTypes: ['api_spec', 'manual'],
  },
  {
    id: 'safety_equipment',
    label: 'Safety Equipment',
    typicalBuyers: ['EHS', 'plants'],
    keyAttributes: ['ansi', 'ppeCategory', 'hazard'],
    documentTypes: ['cert', 'sds', 'manual'],
  },
  {
    id: 'warehousing',
    label: 'Warehousing',
    typicalBuyers: ['3PL', 'DC ops'],
    keyAttributes: ['loadCapacity', 'aisle', 'automation'],
    documentTypes: ['spec', 'safety'],
  },
  {
    id: 'packaging',
    label: 'Packaging',
    typicalBuyers: ['CPG', 'logistics'],
    keyAttributes: ['material', 'dimensions', 'recyclability'],
    documentTypes: ['spec', 'sds'],
  },
];

export function listIndustrialVerticals() {
  return INDUSTRIAL_VERTICAL_CATALOG;
}

export function getIndustrialVertical(id: string): IndustrialVerticalDescriptor | undefined {
  return INDUSTRIAL_VERTICAL_CATALOG.find((v) => v.id === id);
}
