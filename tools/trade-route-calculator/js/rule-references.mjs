import {escapeHtml as esc} from './display.mjs?v=modal-entry-20261011-51';

// Display-only provenance. No campaign values, private source locations or rule
// calculations belong here. Saved audits remain the authority for actual terms.
export const REFERENCE_VERSION='2026.10.10.1';
export const SOURCE_BOOKS=Object.freeze({
 core:Object.freeze({short:'Core 2022',title:'Traveller Core Rulebook Update 2022',edition:'Examined copyright 2024 revision'}),
 cluster:Object.freeze({short:'Cluster Truck',title:'Cluster Truck',edition:'Mongoose Publishing, ©2026; reviewed file dated 16 December 2025'}),
 merchant:Object.freeze({short:'Merchant Prince 1e',title:'Book 7: Merchant Prince',edition:'Mongoose Traveller First Edition, 2010'})
});
const source=(book,pages)=>Object.freeze({book,pages});
const part=(kind,text)=>Object.freeze({kind,text});
const entry=(title,sources,parts)=>Object.freeze({title,sources:Object.freeze(sources),parts:Object.freeze(parts)});
const core=pages=>source('core',pages),merchant=pages=>source('merchant',pages);
export const RULE_REFERENCES=Object.freeze({
 'commodity':entry('commodity availability and trade codes',[core('242, 244–245, 260')],[
  part('Published rule','Commodity prices, availability, quantity dice and UWP trade-code conditions come from these tables. Population modifies generated quantity; repeated goods draws add stock.'),
  part('App convention','Trade codes are derived from the effective world profile. Travel zones are separate map or referee inputs; unknown world fields retain their warnings.'),
  part('Referee input','Exotics and manually entered goods need referee-defined terms. A citation does not supply missing rolls or validate an entered price.')
 ]),
 'contact-search':entry('supplier and buyer searches',[core('241–243')],[
  part('Published rule','A 2D skill check and a separate 1D duration determine a supplier or buyer search. Legal, black-market and online methods use their relevant skills and port modifiers. Online searches require TL8+. The source applies a penalty for earlier attempts in the same month.'),
  part('Home rule · campaign interpretation','Each planet has one 28-day (672-hour) period, starting with its first committed supplier or buyer search. Earlier committed attempts each give DM −1 across all counterparties and methods. All penalties clear together after 28 days; the next committed search starts a new period. Core does not specify this grouped 28-day clock.'),
  part('App convention','Previews and cancelled searches do not count. Search duration advances time only on commit. Recorded legacy results retain their original inputs and totals; current penalty periods are reconstructed in committed-search order. Rejecting an offer uses the separate recorded 30-day counterparty cooldown.')
 ]),
 'trade-price':entry('purchase and sale price rolls',[core('242–245')],[
  part('Published rule','The price roll uses 3D, trader or local-broker skill, the local-broker bonus, commodity modifiers and opposing Broker skill. Purchase and sale use different columns of the bounded modified-price table.'),
  part('Home rule · INT-024','For each commodity modifier column, select the greatest absolute magnitude while retaining its sign; equal opposing magnitudes use the positive value. Buying adds the selected purchase DM and subtracts the sale DM; selling reverses those contributions.'),
  part('Referee input','An entered price or total remains an override. The audit keeps generated and effective values where recorded; missing natural dice stay unknown.')
 ]),
 'broker':entry('local brokers and illegal goods',[core('242–243')],[
  part('Published rule','A local broker or fixer has skill based on 2D ÷ 3, adds +2 to negotiation and normally charges 10%, or 20% for illegal goods. A natural 2 when generating a fixer is a separate referee event. For locally illegal goods, compare the Law Level minus ban threshold against the applicable illegal-sale DM.'),
  part('Home rule · INT-001','The campaign rounds generated broker skill down.'),
  part('Referee input','Manual skill, fee and ban-threshold entries are retained as entered terms. Fixer warnings are separate from price-roll complications.')
 ]),
 'profit':entry('profit retention and price controls',[],[
  part('Home rule','Reduced retains 75% of positive actual profit; Custom uses the chosen 0–100%. Losses are unchanged. RAW 100% describes profit retention only and does not switch off other campaign controls.'),
  part('Home rule','The optional base-retail cap, illegal-goods exception, purchase-percentage floor and sale-percentage ceiling are independent controls. Price limits act before fees; saved offers and referee prices retain their recorded terms.'),
  part('App convention','Allocate recorded cost basis and fees per lot, deduct applicable tax, then adjust only positive remaining profit. Acquisition cost is not debited again on sale. Freight, mail, passenger payments and operating expenses are separate.')
 ]),
 'complication':entry('trade complication flags',[],[
  part('Home rule','On a new natural 3D purchase or sale price roll, exactly two matching dice flag Complication; three matching dice flag Severe. The referee decides the event and consequences. No event table or consequence is applied automatically.'),
  part('App convention','Entered totals without recorded natural faces are unknown. Search, broker and traffic dice do not use this rule; old quotes are not flagged retroactively.'),
  part('Explanation','The dice identify a problem; they have declined to elaborate.')
 ]),
 'freight':entry('freight traffic, lots and fares',[core('239–241')],[
  part('Published rule','Separate traffic rolls for each lot class use both endpoints, distance and search Effect. The selected result band supplies lot-count dice, then size dice determine tons. Freight lots are indivisible; the fare table determines their revenue.'),
  part('App convention','Freight fares use direct endpoint distance, even when the planned route takes several jumps. Accepted payment and generated inputs are frozen with the contract. Contract searches do not themselves advance time.')
 ]),
 'freight-delivery':entry('freight delivery and lateness',[core('241')],[
  part('Published rule','Freight pays on delivery. Late freight reduces payment by (1D + 4) × 10%.'),
  part('App convention','The app applies lateness only against an explicit deadline. The suggested 14 days is an app choice. The penalty die is recorded only when used. This freight penalty is not applied to mail or passengers.'),
  part('Referee input','Manually entered deadlines and payment terms remain referee terms, with their recorded reasons.')
 ]),
 'mail':entry('mail checks and consignments',[core('241')],[
  part('Published rule','Mail uses 2D plus its freight-traffic band, armed-ship, technology, rank and SOC modifiers against 12+. Success generates 1D containers: each occupies 5 tons and pays Cr25,000 on delivery. The whole consignment is accepted together.'),
  part('Home rule · INT-002 / INT-004','Low technology is checked at the origin only. The traffic-to-mail conversion excludes freight lot-class modifiers.'),
  part('App convention','There is no automatic mail lateness penalty. Cancellation is allowed only before a verified first departure. Checks, accepted terms and cancellation history remain separate; old checks do not recreate offers.')
 ]),
 'passengers':entry('passenger traffic and fares',[core('238–239')],[
  part('Published rule','Low, Basic, Middle and High each use a separate 2D traffic check, then count dice. Modifiers include class, both endpoints, distance, search Effect and Steward, without the freight technology modifier. Fares are per person for one jump.'),
  part('Referee input','Additional DMs and population exceptions remain identified in the recorded search or booking.')
 ]),
 'accommodation':entry('passenger accommodation and baggage',[core('158, 238')],[
  part('Published rule','High and Middle normally use private cabins; Basic uses sharing or suitable fitted space, and Low needs installed low berths. Steward requirements apply. High baggage is 1 t/person; Basic and Low use 0.01 t/person.'),
  part('Home rule','This campaign permits explicit High/Middle sharing and uses zero automatic baggage for newly booked Middle passengers. Combined luggage is rounded under the campaign tonnage policy; a whole-ship luggage override, including zero, stays fixed until edited.'),
  part('Referee input','Cabin allocation, fitted Basic space and service cover are explicitly confirmed. Low-berth revival is resolved in play.')
 ]),
 'booking':entry('booking lifecycle and manual contracts',[],[
  part('App convention','Passenger offers are for one jump and can be accepted in part. Boarding reserves accommodation and baggage without payment. Explicit delivery records the agreed payment once and releases the booking. There is no automatic freight lateness penalty on passengers.'),
  part('Referee input','Manual freight/mail quantities, payments and deadlines, and passenger allocation exceptions, retain their entered terms and reasons. Source references do not imply generated dice for a manual contract.'),
  part('App convention','Accepted terms, receipts and Undo are retained. Used life support is restored only by undoing the action that consumed it.')
 ]),
 'jump-duration':entry('jump duration',[core('157')],[
  part('Published rule','Jump duration is 148 + 6D hours, independent of jump distance.'),
  part('App convention','The six faces and generated duration are retained across Cancel and reload. Committing uses the recorded effective elapsed hours.'),
  part('Referee input','An entered duration is an override. This app does not simulate Astrogation, Engineer checks or misjumps.')
 ]),
 'jump-fuel':entry('jump fuel',[core('157')],[
  part('Published rule','Jump fuel is 10% of hull tonnage per parsec; sub-parsec travel uses Jump-1 fuel.'),
  part('Home rule','Required tons round up. A confirmed fuel shortfall is allowed: fuel aboard becomes zero and the missing fuel is resolved in play. The visible shortfall warning remains part of the confirmation.'),
  part('App convention','Only jump fuel consumption is tracked. Tank capacity may include a manually allowed reserve; power-plant consumption, scooping checks and fuel processing are not simulated.')
 ]),
 'refuel':entry('fuel purchases and collection',[core('154, 157, 257–258')],[
  part('Published rule','Standard refined fuel costs Cr500/t; unrefined costs Cr100/t. Starport class provides the standard supply basis.'),
  part('Home rule','The campaign also permits unrefined fuel at A/B ports and free water collection with environmental warnings. New tons and charges use the active campaign rounding policy.'),
  part('Referee input','A nonstandard supplier needs confirmation and a source note. A custom unit price changes price, not fuel grade; the recorded grade and source stay visible.')
 ]),
 'bladders':entry('fuel bladder capacity',[core('184–185')],[
  part('Published context','These pages describe collapsible fuel-tank hardware, footprint and fuel-transfer constraints.'),
  part('Home rule · campaign model','Enter bladder capacity directly in whole tons. Only fuel above the base tank reserves cargo space; empty hardware is already included in ship specifications. Base tanks fill first and bladder fuel is consumed first in bookkeeping.'),
  part('App convention','The app uses one combined fuel store rather than simulating hardware transfer constraints. Installing capacity adds no fuel. Legacy jump-count capacity is preserved when old saves are read.')
 ]),
 'jump-undo':entry('jump mulligans and time controls',[],[
  part('Home rule','Each departure allows one immediate jump mulligan before any later campaign change. Cancel and reload retain prepared dice. Undo Jump restores the pre-jump state and permits the one fresh roll; the used mulligan cannot be reset with Undo.'),
  part('App convention','Browsing and plotting routes do not move the ship. A positive day advance consumes life support; a negative date correction does not restore supplies or reverse transactions. Use Undo for an accidental advance.')
 ]),
 'lss':entry('physical life-support supplies',[source('cluster','14')],[
  part('Published rule · selected adoption','Consumption is 1 LSS per awake person per day, or 0.1 per occupied low berth. Internal storage holds 4 LSS per hull ton. Overflow occupies 0.01 cargo ton per LSS.'),
  part('Home rule','Only these physical consumption and storage mechanics are adopted. Refill and reserve prices use this campaign’s separate pricing policy; other Cluster Truck prices, overheads and consequences are not adopted.')
 ]),
 'support-cost':entry('cabin and person support costs',[core('154')],[
  part('Published rule','The maintenance-period basis is Cr1,000 per stateroom, Cr1,000 per awake person and Cr100 per occupied low berth.'),
  part('Home rule','This campaign keeps Middle/High cabin costs at Cr1,000 and charges Cr3,000 per High-service person. Legacy low-service cabins are separate from frozen berths; new booked Low passengers use Cr100 each.'),
  part('Referee input','Custom cabin rates and baseline occupants remain entered terms. Booked people add their support needs automatically; do not enter them again as baseline occupants.')
 ]),
 'support-pricing':entry('life-support top-up and extra reserve',[core('154')],[
  part('Home rule','Standard top-up prices the supply deficit from current cabin/person costs prorated over 28 days. Extra reserve costs Cr1,000 × person-equivalents × extra days purchased ÷ 28; occupied low berths count as 0.1 person-equivalent. Round the combined extra charge UP once to Cr100.'),
  part('Published context','Core supplies the cabin/person cost basis. These refill prices are campaign choices, not Cluster Truck supply prices.'),
  part('App convention','Standard, extra and comfort charges remain separate in the audit. Comfort purchases add no LSS or days.')
 ]),
 'support-stock':entry('life-support stock and comfort',[],[
  part('App convention','Hourly consumption keeps exact stock. Changing the complement recalculates endurance without refilling supplies. Unknown legacy stock stays unknown until reviewed. Comfort spending adds no LSS or endurance.'),
  part('Referee input','Opening stock and stock corrections are explicit records, not generated supply purchases.'),
  part('Explanation','Better coffee does not count as extra oxygen.')
 ]),
 'hold':entry('cargo reservations',[core('158, 238')],[
  part('App convention','Hold use combines owned cargo, accepted freight/mail, passenger baggage, fitted Basic accommodation, filled fuel bladders and life-support overflow. These reservations count once; an installed empty bladder reserves no cargo.'),
  part('Home rule','High/Middle sharing and zero automatic baggage for newly booked Middle passengers are campaign choices. Luggage is combined before whole-ton rounding. An explicit whole-ship luggage override, including zero, remains fixed until edited.'),
  part('Published context','Core provides the passenger accommodation and baggage basis. The combined hold total is app accounting.')
 ]),
 'mortgage':entry('mortgage payments',[core('149, 153–154')],[
  part('Published rule','The mortgage basis uses ship price ÷ 240 for the periodic payment.'),
  part('App convention','The app tracks an entered fixed payment, installments remaining, paid total and next due date at 28-day intervals. It does not amortize principal. A 480-payment example is a campaign schedule, not exactly 40 of the app’s 365-day years.'),
  part('Referee input','Existing entered terms stay fixed. Confirming payment debits the bank; elapsed time alone does not. Fixed mortgage payments retain their entered Credit amount.')
 ]),
 'maintenance':entry('maintenance costs',[core('153–154')],[
  part('Published context','Core provides ship-maintenance guidance.'),
  part('Referee input','The app uses an entered fixed maintenance amount. It does not calculate annual overhaul or missed-maintenance checks.'),
  part('App convention','Confirmed payment advances its own 28-day schedule and debits the bank. Time alone makes no payment. Fixed maintenance payments retain their entered Credit amount.')
 ]),
 'salary':entry('crew salaries',[core('153–154')],[
  part('Published context','Core provides salary guidance.'),
  part('Referee input','The app takes an entered total, not a calculated crew roster. Select how many 28-day billing periods to pay.'),
  part('App convention','Only confirming payment debits the bank. Elapsed time does not automatically pay salaries; the charge uses the active monetary rounding policy.')
 ]),
 'berthing':entry('weekly berthing fees',[core('257–258')],[
  part('Published rule','A saved 1D roll determines the weekly fee using the starport multiplier: A × Cr1,000; B × Cr500; C × Cr100; D × Cr10; E/X zero. The rate remains stable for that starport.'),
  part('App convention','The app charges the selected whole weeks and records the roll and multiplier. New charges use the active campaign rounding policy; confirmed payment debits the bank.')
 ]),
 'insurance':entry('optional cargo insurance',[merchant('82–83')],[
  part('Published rule · optional adaptation','Merchant Prince supplies the coverage/distance premium table and route-risk basis. This source is from the first-edition rules.'),
  part('Home rule · INT-011–015','The planned route supplies distance. Amber and Red surcharges apply once each. Goods value excludes fees; the premium joins actual cost basis. Over six parsecs needs a referee quote.'),
  part('App convention / referee input','This optional module is off by default. Policies preserve covered lots, quantities, route inputs and premium. Amendments and partial claims need referee terms; sold quantities end coverage. The complete policy/claim lifecycle is an adaptation, not a claim of unmodified published rules.')
 ]),
 'tax':entry('optional trade tax',[merchant('86–87')],[
  part('Published rule · optional adaptation','The taxation discussion is on p.86 and its table on p.87. Government and taxable-profit bracket select the rate, with dice only where required. This source is from the first-edition rules.'),
  part('Home rule · INT-007–022','The printed table omits Cr75,001–76,000. INT-009 extends the app’s bracket down to Cr75,001; this is an approved correction, not a publisher erratum. The “Feudal Democracy” row maps to UWP 5, Feudal Technocracy.'),
  part('Home rule','One committed sale uses one bracket from net profit against the normal-value benchmark. Tax is allocated to positive-gain lots, criminal-market trades have no automatic tax, and tax comes before positive actual-profit retention.'),
  part('Referee input / app convention','This optional module is off by default. Entered tax rates are overrides. Current charges round upward under the active policy; historical recorded amounts and dice stay unchanged.')
 ]),
 'rounding':entry('rounding and recorded amounts',[],[
  part('Home rule','New final monetary amounts round UP once to whole Credits, or Cr100 when selected. New ton entries use the whole-ton policy. Fixed mortgage and maintenance payments retain their entered amounts; extra-reserve support charges have their separate Cr100 rule.'),
  part('App convention','Exact intermediate quantities and per-lot cost allocation are retained. Partial-sale cost-basis allocation rounds down to whole Credits and leaves its remainder on the lot; the final sale consumes all remaining basis. Historical amounts keep their recorded precision.'),
  part('Referee input','An entered value or correction is shown separately from generated data where recorded. Missing legacy evidence is Not recorded; current references do not recompute old transactions.')
 ])
});

export function ruleReference(id){const value=RULE_REFERENCES[id];if(!value)throw Error('Unknown rules reference: '+id);return value;}
export function ruleInfo(id){const reference=ruleReference(id);return '<button type="button" class="rule-info" data-rule-info="'+esc(id)+'" aria-label="Rules reference for '+esc(reference.title)+'" aria-haspopup="dialog"><span aria-hidden="true">i</span></button>';}
export function referenceMarkup(id){
 const reference=ruleReference(id);
 return reference.sources.map(({book,pages})=>{const b=SOURCE_BOOKS[book];return '<p class="rule-source"><strong>'+esc(b.short)+(/^[0-9]+$/.test(pages)?' p. ':' pp. ')+esc(pages)+'</strong><br>'+esc(b.title)+' · '+esc(b.edition)+' · printed page'+(/^[0-9]+$/.test(pages)?' ':'s ')+esc(pages)+'</p>';}).join('')+reference.parts.map(({kind,text})=>'<section class="rule-reference-part"><h3>'+esc(kind)+'</h3><p>'+esc(text)+'</p></section>').join('');
}
export function referenceIndex(){return '<div class="rule-reference-index">'+Object.entries(RULE_REFERENCES).map(([id,{title}])=>'<div>'+esc(title[0].toUpperCase()+title.slice(1))+' '+ruleInfo(id)+'</div>').join('')+'</div>';}
