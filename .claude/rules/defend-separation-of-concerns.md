# Defend Separation of Concerns — Push Back Before You Tangle

Satisfying a prompt is never a reason to tangle separation of concerns. When a request would place a concern in the wrong layer, break an established boundary, or trade a clean design for a quick "yes," the correct response is to push back, explain the trade-off, and propose the right-layer alternative — not to comply and quietly make the architecture worse.

This rule exists because of a concrete, costly incident. To satisfy a request for role-based access control, an agent first proposed pushing the role check down into the *data layer* (a hand-rolled filter inside a Supabase query helper, with no RLS), and then, when the team objected, proposed bolting an authorization decorator onto a single *Route Handler* as the only gate. Both are wrong-layer placements, both were more confusing than the problem they solved, and together they cost about a day. Neither would have happened if the agent had pushed back and named the layering rule instead of reshaping the architecture to fit the prompt.

## The obligation

When a request conflicts with the layering doctrine in [`layered-architecture.md`](layered-architecture.md), with SOLID, with an ADR, or with another rule, do this:

1. **Do not silently comply.** State the conflict in one or two sentences and name the boundary it crosses.
2. **Cite the rule, ADR, or principle, and explain the concrete cost** — for example, "a role check buried in a Supabase query helper couples the data layer to identity and can't express an ownership rule," or "a guard in one Route Handler protects only that path and leaves every other caller and a direct query ungated — only an RLS policy enforces it everywhere."
3. **Propose the correct-layer alternative,** and make it the simplest one that works.
4. **Then let the owner decide.** If, after a clear and evidence-based pushback, the owner still chooses the other path and it is genuinely their call — not a security or owner-locked matter — proceed, but record the deviation where the next person will see it: a `docs/security/be-careful.md` entry, or an ADR if it is architectural.

Pushing back is mandatory; stubbornness is not. Defend the design with evidence, then respect a deliberate, informed decision.

## Both directions of the same discipline

The incident was two failures at once. Putting the check in the data layer was a separation-of-concerns failure; replacing it with a bolted-on decorator gate was an overengineering failure — far more machinery than a one-line guard plus an RLS policy. So this rule runs in both directions.

- **Do not tangle concerns to satisfy a prompt.** Keep authentication, authorization, data access, and transport in their own layers, exactly as [`layered-architecture.md`](layered-architecture.md) lays out.
- **Do not add machinery to satisfy a prompt.** Prefer the simplest correct solution, reuse what already exists, and reach for a design pattern only when it genuinely removes code, as [`simplicity-no-overengineering.md`](simplicity-no-overengineering.md) and [`dry-beyond-sx.md`](dry-beyond-sx.md) require. A framework, an authorization engine, a DI container, or a new abstraction with no present caller is overengineering even when the prompt asks for it.

Reuse first, honor SOLID and established design patterns, and reuse the seam where it already exists — but never build speculative structure. Simplicity is the default, and the burden of proof falls on added complexity, not on leaving it out.

## When this rule fires

Any request that would place a concern in the wrong layer, add a speculative abstraction or framework, duplicate logic that already has a home, or otherwise trade separation of concerns or simplicity for prompt-satisfaction. It applies to every agent, in every session, however the request is phrased — including when the request is detailed, confident, and specific about the wrong approach.
