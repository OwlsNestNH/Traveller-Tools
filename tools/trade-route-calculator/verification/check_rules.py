#!/usr/bin/env python3
"""Validate review data and independent expected cases; not application tests."""
import json, math
from pathlib import Path
from fractions import Fraction
ROOT = Path(__file__).resolve().parents[1]
core = json.loads((ROOT / "rules/core-2022.json").read_text(encoding="utf-8"))
mp = json.loads((ROOT / "rules/merchant-prince-1e.json").read_text(encoding="utf-8"))
passed = []
def check(label, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}; got {actual!r}")
    passed.append(label)
goods = {g["id"]: g for g in core["commodities"]}
check("D66 completeness", sorted(goods), [f"{a}{b}" for a in range(1,7) for b in range(1,7)])
check("commodity IDs unique", len(goods), len(core["commodities"]))
known = set(core["tradeCodes"]["conditions"]) | {"Amber", "Red"}
for g in goods.values():
    check("known codes " + g["id"], set(g["availabilityAny"]) | set(g["purchaseDM"]) | set(g["saleDM"]) <= known, True)
    if not g["refereeDefined"]:
        check("positive commodity base " + g["id"], g["baseCreditsPerTon"] > 0, True)
check("exotics manual", goods["66"]["baseCreditsPerTon"], None)
check("negative common consumables modifier", goods["15"]["purchaseDM"]["As"], -4)
check("radioactives negative sale modifier", goods["45"]["saleDM"]["Ag"], -3)
check("illegal cybernetics rich modifier", goods["62"]["saleDM"]["Ri"], 8)
check("textiles quantity multiplier", goods["52"]["quantity"]["multiplier"], 20)
check("radioactives megacredit conversion", goods["45"]["baseCreditsPerTon"], 1000000)
prices = {r["result"]:r for r in core["priceTable"]["rows"]}
check("price domain", sorted(prices), list(range(-3,26)))
def price(result, column):
    return prices[max(-3,min(25,result))][column + "Percent"]
check("E01 purchase", 1000 * price(12,"purchase") // 100, 800)
check("E02 sale", 1000 * price(8,"sale") // 100, 800)
check("E03 low clamp", (price(-4,"purchase"),price(-4,"sale")), (300,10))
check("E03 high clamp", (price(26,"purchase"),price(26,"sale")), (15,400))
def match(value, rule):
    if "anyOf" in rule: return any(match(value,r) for r in rule["anyOf"])
    if "equals" in rule and value != rule["equals"]: return False
    if "oneOf" in rule and value not in rule["oneOf"]: return False
    return ("min" not in rule or value >= rule["min"]) and ("max" not in rule or value <= rule["max"])
def code(name, **values):
    return all(match(values[k],r) for k,r in core["tradeCodes"]["conditions"][name].items())
check("Ag lower boundaries", code("Ag", atmosphere=4,hydrographics=4,population=5), True)
check("Ag upper boundaries", code("Ag", atmosphere=9,hydrographics=8,population=7), True)
check("Ag population below", code("Ag", atmosphere=4,hydrographics=4,population=4), False)
check("Ri government requirement", code("Ri",atmosphere=6,population=8,government=3), False)
check("Ri upper government", code("Ri",atmosphere=8,population=8,government=9), True)
check("Lt excludes empty world", code("Lt",population=0,techLevel=5), False)
check("Lt boundary", code("Lt",population=1,techLevel=5), True)
check("Wa atmosphere gap", code("Wa",atmosphere=12,hydrographics=10), False)
check("Wa atmosphere upper band", code("Wa",atmosphere=13,hydrographics=10), True)
check("Ba all three zero", code("Ba",population=0,government=0,law=0), True)
check("Ba law nonzero", code("Ba",population=0,government=0,law=1), False)
check("In excludes atmosphere 3", code("In",atmosphere=3,population=9), False)
check("In includes atmosphere C", code("In",atmosphere=12,population=9), True)
check("E04 zero quantity",max(0,2+core["availability"]["populationQuantityDM"][0]["dm"])*5,0)
check("E05 large quantity",(2+core["availability"]["populationQuantityDM"][1]["dm"])*5,25)
freight=core["freight"]
check("freight jump 3",freight["paymentCreditsPerTonByParsecs"]["3"],2600)
check("freight traffic 6",freight["trafficTable"][5]["numberOfLotDice"],3)
check("freight traffic 20",freight["trafficTable"][19]["numberOfLotDice"],10)
check("E07 late freight",10000 * (100-(2+freight["latePenalty"]["add"])*freight["latePenalty"]["multiplyPercent"])//100,4000)
check("E06 mail volume",4*core["mail"]["tonsPerContainer"],20)
check("E06 mail payout",4*core["mail"]["paymentCreditsPerContainer"],100000)
jump=core["travel"]["jumpDuration"]
check("E08 jump boundaries",(jump["fixedHours"]+jump["dice"],jump["fixedHours"]+jump["dice"]*jump["sides"]),(154,184))
rows=mp["insurance"]["premiumRows"]
check("insurance dimensions",[len(r["premiumPercent"]) for r in rows],[9]*7)
index=mp["insurance"]["coveragePercent"].index(70)
rate=next(r for r in rows if r["distance"]=="3")["premiumPercent"][index]
check("insurance example rate",rate+mp["insurance"]["surchargePercentagePoints"]["Amber"],11)
check("insurance example premium",80800*11//100,8888)
check("insurance example corrected total",80800+8888,89688)
check("insurance example payout",80800*70//100,56560)
check("insurance subparsec fractional rate",rows[0]["premiumPercent"][0],0.5)
tax=mp["tax"]
check("tax bracket count",len(tax["brackets"]),10)
for left,right in zip(tax["brackets"],tax["brackets"][1:]):
    check("tax bracket continuity "+str(left["minCredits"]),left["maxCredits"]+1,right["minCredits"])
def bracket(value):
    return next(i for i,r in enumerate(tax["brackets"]) if value>=r["minCredits"] and (r["maxCredits"] is None or value<=r["maxCredits"]))
for v,i in [(75000,5),(75001,6),(76000,6),(76001,6),(100000,6),(100001,7)]:
    check("tax corrected boundary "+str(v),bracket(v),i)
rates={r["uwpGovernmentCode"]:r["rates"] for r in tax["governmentRates"]}
for gov,r in rates.items(): check("tax rate width "+gov,len(r),10)
check("tax source example rate",rates["4"][bracket(10000)]["percent"],8)
check("tax actual vs benchmark",(80000-70000,80000-60000),(10000,20000))
check("tax before reduced profit",math.floor((20000-800)*Fraction(3,4)),14400)
check("tax sale bank credit",80000-800+(14400-19200),74400)
check("tax-induced loss preserved",100-800,-700)
check("E09 reduced profit",math.floor(101*Fraction(3,4)),75)
check("E09 bank increase",1500-150+(75-101),1324)
basis,quantity=100,3
alloc=[]
for sold in [1,1,1]:
    part=basis if sold==quantity else basis*sold//quantity
    alloc.append(part); basis-=part; quantity-=sold
check("E10 partial basis remainder",alloc,[33,33,34])
# Supplemental decision and mixed-sale cases.
check("criminal-market exemption",tax["criminalMarket"],"zero-automatic-tax")
check("government-five mapping",tax["sourceLabelNotes"][0]["status"],"owner-approved-INT-020")
taxable = Fraction(4003,4)  # Cr1000.75
check("fractional bracket floor",bracket(max(1,math.floor(taxable))),0)
check("fractional final tax",math.floor(taxable*Fraction(5,100)),50)
check("subcredit positive bracket",bracket(max(1,math.floor(Fraction(1,2)))),0)
gains=[6000,4000,-2000]
posted_tax=sum(gains)*8//100
check("mixed sale net tax",posted_tax,640)
check("mixed sale allocation",[posted_tax*max(0,g)//10000 for g in gains],[384,256,0])
check("premium cost basis",10000+1000+1100,12100)
check("partial insured loss",10000*2//10*70//100,1400)
check("remaining insured purchase value",10000-10000*2//10,8000)
uwp="A788899-C"
fields={k:(uwp[i] if k=="starport" else core["uwp"]["numericAlphabet"].index(uwp[i])) for k,i in core["uwp"]["fieldIndices"].items()}
check("UWP field positions",fields,dict(starport="A",size=7,atmosphere=8,hydrographics=8,population=8,government=9,law=9,techLevel=12))
check("eHex J skips I",core["uwp"]["numericAlphabet"].index("J"),18)
check("eHex P skips O",core["uwp"]["numericAlphabet"].index("P"),23)
# Combined source-based scenarios (not runtime tests).
def endpoint(pop, port, tl, zone):
    out=0
    for field,value in [("population",pop),("techLevel",tl)]:
        out+=sum(r["dm"] for r in freight["endpointDM"][field] if match(value,{k:v for k,v in r.items() if k!="dm"}))
    return out+freight["endpointDM"]["starport"].get(port,0)+freight["endpointDM"]["zone"].get(zone,0)
# Origin pop 8 / A / TL9 / Amber => 4+2+2-2=6.
# Destination pop 1 / E / TL6 / Red => -4-1-1-6=-12.
# Three parsecs => -2; search Effect +3 => shared DM -5.
shared=endpoint(8,"A",9,"Amber")+endpoint(1,"E",6,"Red")-2+3
check("combined freight shared DM",shared,-5)
check("major freight DM",shared+freight["lotTypes"]["major"]["trafficDM"],-9)
check("incidental freight DM",shared+freight["lotTypes"]["incidental"]["trafficDM"],-3)
mail=core["mail"]
mail_band=next(r["dm"] for r in mail["freightDMBands"] if match(shared,{k:v for k,v in r.items() if k!="dm"}))
check("mail shared band excludes lot modifier",mail_band,-1)
# Dice 8; armed +2; rank 2; SOC +1; origin TL9 => no low-tech penalty.
check("mail combined success total",8+mail_band+mail["armedShipDM"]+2+1,12)
check("mail low-tech origin penalty",mail["lowTech"]["dm"],-4)
check("mail low-tech destination alone ignored",mail["lowTech"]["endpoint"],"origin")
broker=core["negotiation"]["localBroker"]
check("broker floor low",2//broker["skillDivisor"],0)
check("broker floor high",11//broker["skillDivisor"],3)
# Common electronics on In,Ht,Ri: purchase max3, sale max2 for Ni/Lt/Po hypothetical separate sale world.
check("commodity DM maximum",max(goods["11"]["purchaseDM"][k] for k in ["In","Ht","Ri"]),3)
check("negative-only DM preserved",max(goods["15"]["purchaseDM"][k] for k in ["As"]),-4)
# Purchase 3D=10 + local skill2 + local2 + purchase3 - sale0 - counterparty2 =15.
modified=10+2+broker["negotiationDM"]+3-0-core["negotiation"]["counterpartyDefaultSkill"]
check("local broker price result",modified,15)
unit=goods["11"]["baseCreditsPerTon"]*price(modified,"purchase")//100
check("local broker commodity unit price",unit,13000)
gross=unit*2
fee=gross*broker["normalFeePercent"]//100
check("broker fee uses gross goods value",fee,2600)
check("acquisition basis including broker",gross+fee,28600)
check("half-lot acquisition basis including fee",(gross+fee)//2,14300)
check("illegal broker standard fee",gross*broker["illegalFeePercent"]//100,5200)
check("illegal sale DM selects higher",max(9-3,4),6)
check("illegal sale DM not added",max(9-3,8),8)
# Unknown fields stay unknown; malformed transport input is rejected.
def parse_uwp(text):
    alphabet=core["uwp"]["numericAlphabet"]
    if len(text)!=9 or text[7]!="-" or text[0] not in "ABCDEFGHXY?":
        raise ValueError("Unsupported UWP")
    values={"starport":None if text[0]=="?" else text[0]}
    for field,i in core["uwp"]["fieldIndices"].items():
        if field=="starport": continue
        c=text[i]
        if c=="?": values[field]=None
        elif c in alphabet: values[field]=alphabet.index(c)
        else: raise ValueError("Unsupported UWP digit")
        if values[field] is not None and field in core["uwp"]["fieldMaxima"] and values[field]>core["uwp"]["fieldMaxima"][field]: raise ValueError("Unsupported UWP range")
    return values
check("unknown UWP preserved",parse_uwp("A??????-?")["population"],None)
for bad in ["", "A788899C", "A788899/C","A788899-I","A788899-O","AS88899-C","A78B899-C"]:
    try: parse_uwp(bad)
    except ValueError: rejected=True
    else: rejected=False
    check("invalid UWP "+repr(bad),rejected,True)
# Tax-allocation remainder: equal positive gains, Cr1 tax => stable first lot receives remainder.
weights=[Fraction(1,2),Fraction(1,2)]
shares=[math.floor(x) for x in weights]
for i in sorted(range(2),key=lambda i:(-(weights[i]-shares[i]),i))[:1-sum(shares)]:
    shares[i]+=1
check("tax allocation stable remainder",shares,[1,0])

for raw,pct,expected in [(100,75,75),(-100,75,-100),(0,75,0),(101,100,101),(101,0,0),(101,50,50)]:
    check(f"profit mode {raw}/{pct}",math.floor(Fraction(raw*pct,100)) if raw>0 else raw,expected)
check("mixed lots no profit netting",75-100,-25)
print(f"PASS: {len(passed)} data and expected-result checks.")
print("Scope: review-data validation only. No application or browser tests.")
