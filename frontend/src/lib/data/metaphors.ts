export interface Metaphor {
  id: string;
  title: string;
  keywords: string[];
  analogy: string;
  azure: string;
  examTip: string;
}

export const METAPHORS: Metaphor[] = [
  {
    id: "zones", title: "Regions & Availability Zones",
    keywords: ["availability zone", "zone", "region", "datacenter", "datacentre", "power grid"],
    analogy: "Think of a region as a whole county's electricity supply. Inside it, Availability Zones are separate substations, each with its own transformers and lines. If one substation trips, the others keep the lights on in the county.",
    azure: "A region is a set of datacentres in one area. Availability Zones are physically separate locations inside a region, each with independent power, cooling and networking. Spread VMs across zones to survive a datacentre failure.",
    examTip: "Zones protect against a datacentre outage; region pairs protect against a whole-region disaster.",
  },
  {
    id: "pairs", title: "Region pairs",
    keywords: ["region pair", "paired", "disaster recovery", "dr"],
    analogy: "A national grain reserve keeps a depot in Nakuru and a twin depot in Eldoret. If floods close one, the other feeds the country, and repairs are never done at both depots on the same day.",
    azure: "Most regions are paired with another region in the same geography, hundreds of kilometres apart. Platform updates roll out to one at a time, and recovery is prioritised for one of each pair.",
    examTip: "Pairs = same geography, far apart, updated one at a time.",
  },
  {
    id: "blob-sql", title: "Blob Storage vs SQL Database",
    keywords: ["blob", "sql", "storage", "database", "unstructured", "granary", "ledger"],
    analogy: "Blob Storage is a wholesale granary: you pour in huge sacks of anything — maize, beans, photos, videos — and find them by label. Azure SQL is a bank's indexed ledger: every row has strict columns, and you can ask precise questions like 'all deposits over 5,000 shillings in March'.",
    azure: "Blob Storage holds massive unstructured data cheaply. Azure SQL Database is a managed relational database for structured data with queries, joins and transactions.",
    examTip: "Media, backups, logs → Blob. Structured records with relationships → SQL.",
  },
  {
    id: "tiers", title: "Blob access tiers",
    keywords: ["hot", "cool", "cold", "archive", "tier"],
    analogy: "Hot tier is the shop counter — goods you sell daily, quick to reach but pricey shelf space. Cool and Cold are the back storeroom. Archive is the sealed warehouse upcountry: cheapest rent, but it takes hours to send a lorry for your goods.",
    azure: "Hot, Cool, Cold and Archive trade storage cost against access cost and latency. Archive data must be rehydrated before reading.",
    examTip: "Rarely read, long retention → Archive.",
  },
  {
    id: "queues", title: "Queues & Event Grid",
    keywords: ["queue", "event grid", "service bus", "message", "messaging", "event", "m-pesa", "mpesa"],
    analogy: "On a Friday evening at a busy market, thousands of M-Pesa payments arrive in seconds. The system doesn't process them all at once; each transaction joins a queue and is settled reliably in order. Event Grid is the SMS notification that fires the instant a payment lands, telling every interested party.",
    azure: "Queue Storage and Service Bus buffer messages so slow consumers can keep up with bursts. Event Grid pushes event notifications to subscribers in near real time.",
    examTip: "Queue = buffer work. Event Grid = react to something that happened.",
  },
  {
    id: "vnet", title: "VNet peering",
    keywords: ["vnet", "peering", "virtual network", "matatu", "network"],
    analogy: "Picture two matatu SACCOs, one serving Westlands and one serving Embakasi. Peering is a shared private terminus where passengers switch routes without ever walking out onto the open highway.",
    azure: "VNet peering connects two virtual networks so resources talk privately over Microsoft's backbone with low latency — no public internet hop.",
    examTip: "Peering is non-transitive: A↔B and B↔C does not give A↔C.",
  },
  {
    id: "express", title: "VPN Gateway vs ExpressRoute",
    keywords: ["vpn", "expressroute", "express route", "hybrid", "on-premises", "on premises"],
    analogy: "A VPN is sending cash in a locked box on a public bus: it's secure but shares the road. ExpressRoute is your company's own private road from the office to the Azure depot.",
    azure: "VPN Gateway sends encrypted traffic over the public internet. ExpressRoute is a private connection through a connectivity provider that bypasses the internet.",
    examTip: "'Does not traverse the public internet' → ExpressRoute.",
  },
  {
    id: "shared", title: "Shared responsibility model",
    keywords: ["shared responsibility", "responsibility", "iaas", "paas", "saas", "service model"],
    analogy: "IaaS is renting an empty plot: the landlord fences it, you build and maintain the house. PaaS is renting a furnished apartment: you just bring your belongings. SaaS is a hotel room: you show up, and you're only responsible for your own luggage and room key.",
    azure: "The more managed the service, the more Microsoft handles. Customers always own their data, devices, accounts and identities.",
    examTip: "Data, identities and devices are ALWAYS the customer's job.",
  },
  {
    id: "elastic", title: "Elasticity & scaling",
    keywords: ["elastic", "elasticity", "scale", "scaling", "autoscale", "scale out", "scale up"],
    analogy: "A boda boda stage at rush hour calls in extra riders and releases them when the crowds thin. That's scaling out and in. Swapping a boda for a tuk-tuk is scaling up.",
    azure: "Horizontal scaling adds or removes instances; vertical scaling resizes one. Elasticity does it automatically with demand.",
    examTip: "More instances = out. Bigger instance = up.",
  },
  {
    id: "policy", title: "Azure Policy vs RBAC",
    keywords: ["policy", "rbac", "role", "governance", "permission", "access"],
    analogy: "RBAC is the guard at the county office deciding WHO may enter and which rooms they may use. Azure Policy is the building code that says WHAT may be built — no structures taller than four floors, regardless of who is building.",
    azure: "RBAC grants permissions to users, groups and identities at a scope. Azure Policy evaluates and can deny or audit resource configurations.",
    examTip: "Who → RBAC. What/where → Policy.",
  },
  {
    id: "locks", title: "Resource locks",
    keywords: ["lock", "delete", "readonly", "read-only"],
    analogy: "A Delete lock is like a title deed held at the land registry: you can renovate the house but can't sell it off by accident. ReadOnly is a heritage site: you can look, but no changes at all.",
    azure: "CanNotDelete allows reads and changes but blocks deletion. ReadOnly allows reads only. Locks apply even to Owners until removed.",
    examTip: "Locks override RBAC permissions.",
  },
  {
    id: "hierarchy", title: "Management hierarchy",
    keywords: ["management group", "subscription", "resource group", "hierarchy", "scope"],
    analogy: "The nation sets rules (management group), counties manage budgets (subscriptions), wards group related projects (resource groups), and each borehole or classroom is a resource. Rules set at the nation level flow down to every ward.",
    azure: "Management groups → subscriptions → resource groups → resources. Policies and RBAC inherit downward.",
    examTip: "Assign at the highest sensible scope to govern many subscriptions at once.",
  },
];

export const SUGGESTIONS = [
  "Explain Azure VNet peering like a commuter matatu network",
  "Availability Zones vs regions, Kenyan power-grid style",
  "Blob Storage vs SQL — granary or ledger?",
  "How do queues handle M-Pesa peak hours?",
  "Azure Policy vs RBAC in simple terms",
  "Shared responsibility model with a housing analogy",
];

export function findMetaphor(query: string): Metaphor | null {
  const q = query.toLowerCase();
  let best: Metaphor | null = null;
  let bestScore = 0;
  for (const m of METAPHORS) {
    const score = m.keywords.reduce((s, k) => (q.includes(k) ? s + k.length : s), 0);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

export function buddyReply(query: string): string {
  const m = findMetaphor(query);
  if (!m) {
    return `I don't have a local analogy for that one yet. I can explain these topics offline: ${METAPHORS.map((x) => x.title).join(", ")}. Try asking about one of them!`;
  }
  return `**${m.title}**\n\n🌍 ${m.analogy}\n\n☁️ In Azure terms: ${m.azure}\n\n🎯 Exam tip: ${m.examTip}`;
}
