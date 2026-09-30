/* data.js \u2014 schema defaults for VillageMan.
   SHAREABILITY RULE: defaultData() returns ONLY empty arrays and zeros.
   NEVER hardcode names, house numbers, amounts, or any personal data here.
   All real data comes from storage (localStorage in Phase 1). */

const SKEY = 'community_manager_v1';

/* Empty, shareable default state. */
function defaultData(){
  return {
    meta: { version: 1, currency: 'THB', promptpay_id: '', estate_name: '', lists: {}, tariff: [], rates: {} },
    households: [],          // {id, house_no, owner_name, tenant_name, phone, email, status}
    fee_types: [],           // {id, name, default_amount, recurrence}
    fee_charges: [],         // {id, household_id, fee_type_id, period, amount_due, due_date, status}
    payments: [],            // {id, fee_charge_id, paid_amount, paid_date, method, slip_url, receipt_no}
    expenses: [],            // {id, category, description, amount, expense_date, vendor_id, receipt_url}
    meters: [],              // registry of common-area meters (set up once) - see shape below
    utility_bills: [],       // common-area metered bills \u2014 see shape below
    vendors: [],             // {id, name, service_type, phone, email, notes, rating}
    emergency_contacts: [],  // {id, label, phone, category, sort_order}
    counters: { receipt_seq: 0 } // running receipt number sequence
  };
}
/* meters record shape (set up ONCE per common-area meter):
   {id, purpose (label e.g. \u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19), utility_type ('electricity'|'water'|'internet'|'other'),
    provider ('MEA'|'PEA'|''), meter_no, reference_no, notes} */
/* utility_bills record shape (COMMON-AREA / \u0e2a\u0e48\u0e27\u0e19\u0e01\u0e25\u0e32\u0e07 expense \u2014 never billed to a house):
   {id, utility_type ('electricity'|'water'|'internet'|'other'),
    purpose (label for the common-area meter: e.g. '\u0e44\u0e1f\u0e2b\u0e21\u0e39\u0e48\u0e1a\u0e49\u0e32\u0e19','\u0e44\u0e1f\u0e17\u0e32\u0e07\u0e40\u0e14\u0e34\u0e19','CCTV','pump','other'),
    provider ('MEA'|'PEA'|''), meter_no, reference_no,
    reading_date (YYYY-MM-DD cutoff), due_date (YYYY-MM-DD deadline), period (YYYY-MM),
    prev_reading, present_reading, units_used (auto), energy_charge, ft, vat, total_amount,
    paid (bool), paid_date, receipt_path, notes,
    // split-meter (piggybacked central sub-meter on a home meter):
    split_meter (bool), bill_total (full MEA bill), central_prev, central_present, central_units,
    avg_rate (bill_total/units_used), central_amount (=total_amount when split), home_units, home_amount} */

/* Alias kept for parity with Cash Flow Planner conventions. */
function emptyData(){ return defaultData(); }

/* Migrate/normalise a loaded object so missing keys never crash the UI.
   All fallbacks are empty/zero \u2014 never a real value. */
function migrate(d){
  const base = defaultData();
  if(!d || typeof d !== 'object') return base;
  return {
    meta: Object.assign(base.meta, d.meta || {}),
    households: Array.isArray(d.households) ? d.households : [],
    fee_types: Array.isArray(d.fee_types) ? d.fee_types : [],
    fee_charges: Array.isArray(d.fee_charges) ? d.fee_charges : [],
    payments: Array.isArray(d.payments) ? d.payments : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    meters: Array.isArray(d.meters) ? d.meters : [],
    utility_bills: Array.isArray(d.utility_bills) ? d.utility_bills : [],
    vendors: Array.isArray(d.vendors) ? d.vendors : [],
    emergency_contacts: Array.isArray(d.emergency_contacts) ? d.emergency_contacts : [],
    counters: Object.assign(base.counters, d.counters || {})
  };
}

window.CM_DATA = { SKEY, defaultData, emptyData, migrate };
