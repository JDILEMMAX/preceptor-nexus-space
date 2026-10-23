import type { AppState, Flashcard } from "../types";

const starter: Array<Pick<Flashcard, "domain" | "front" | "back">> = [
  { domain: "cloud", front: "IaaS vs PaaS vs SaaS — who patches the OS?", back: "IaaS: you. PaaS & SaaS: Microsoft." },
  { domain: "cloud", front: "Elasticity", back: "Automatically adding and removing resources as demand changes." },
  { domain: "cloud", front: "CapEx vs OpEx", back: "CapEx = up-front purchase of assets. OpEx = pay-as-you-go spending. Cloud is OpEx." },
  { domain: "cloud", front: "Hybrid cloud", back: "On-premises/private resources combined with public cloud." },
  { domain: "cloud", front: "Scale up vs scale out", back: "Up (vertical) = bigger machine. Out (horizontal) = more machines." },
  { domain: "architecture", front: "Availability Zone", back: "A physically separate datacentre group within a region with independent power, cooling and network." },
  { domain: "architecture", front: "Region pair", back: "Two regions in the same geography used for disaster recovery and staged updates." },
  { domain: "architecture", front: "Blob access tiers", back: "Hot → Cool → Cold → Archive: storage gets cheaper, access gets slower/costlier." },
  { domain: "architecture", front: "VNet peering", back: "Private connection between virtual networks over the Microsoft backbone." },
  { domain: "architecture", front: "VPN Gateway vs ExpressRoute", back: "VPN: encrypted over public internet. ExpressRoute: private dedicated link." },
  { domain: "management", front: "Azure Policy vs RBAC", back: "Policy controls WHAT resources/settings are allowed. RBAC controls WHO can act." },
  { domain: "management", front: "Resource lock types", back: "Delete (CanNotDelete): change but not delete. ReadOnly: no changes at all." },
  { domain: "management", front: "Scope hierarchy", back: "Management group → Subscription → Resource group → Resource." },
  { domain: "management", front: "Pricing calculator vs Cost Management", back: "Calculator estimates future cost. Cost Management analyses actual spend." },
  { domain: "management", front: "Azure Arc", back: "Manage on-prem and multicloud resources through Azure Resource Manager." },
];

export function makeSeedState(now = Date.now()): AppState {
  return {
    answers: [],
    attempts: [],
    cards: starter.map((c, i) => ({ ...c, id: `starter-${i}`, box: 1, due: now, source: "starter" as const })),
    plan: { examDate: null, hoursPerDay: 2, done: [] },
    bookmarks: [],
    chat: [],
  };
}
