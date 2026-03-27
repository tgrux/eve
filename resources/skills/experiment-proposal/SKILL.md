---
name: experiment-proposal
description: Create structured Experiment Proposals for Kin Insurance Skunkworks R&D initiatives. Use when someone has a technical idea, innovation concept, or R&D exploration that needs validation before becoming a project. Also use when closing out an experiment that needs its outcome path defined (Project Proposal, Surface, or Dead End). Triggers include requests to write an experiment proposal, validate an idea, structure a hypothesis, create documentation for Skunkworks intake, or define next actions for a completed experiment. This skill applies the scientific method to technical innovation work.
---
 
# Experiment Proposal Skill
 
Create Experiment Proposals for Skunkworks-initiated R&D projects and technical explorations. These proposals apply the scientific method to technical innovation, ensuring rigorous thinking before building — and ensuring experiments produce actionable outcomes, not just findings.
 
## When This Is Needed
 
Experiment Proposals are required for:
- Skunkworks-initiated R&D projects
- Technical explorations and innovations
- Ideas from sources other than the Product team
- Closing out completed experiments with a defined outcome path
 
Not needed for Product-originated ideas (Product should have already conducted research and validation).
 
## Proposal Structure
 
Every Experiment Proposal follows the scientific method with six sections:
 
### 1. Observation
*What problem or opportunity have we identified? What patterns are we seeing in the current state?*
 
Write a clear description of:
- The current state and its limitations
- Pain points or inefficiencies observed
- The opportunity or trigger for this idea
- Any relevant context (costs, time, quality issues)
 
Keep factual. Avoid solution language here.
 
### 2. Hypothesis
*What do we believe will happen if we build a solution? What specific outcomes do we expect?*
 
Structure as: "We believe that [solution] will [outcome]"
 
Include:
- Specific expected outcomes (not vague improvements)
- How outcomes influence decisions, risks, or money
- What changes if the hypothesis is true
 
Avoid fabricated metrics. Use directional language ("reduce," "eliminate," "enable") rather than invented percentages or dollar amounts unless the user provides real data.
 
### 3. Experiment
*How will we test our hypothesis? What's the minimum viable approach to validate our assumptions?*
 
Identify:
- Which assumptions are riskiest or most uncertain
- The minimum viable test for each assumption
- What would prove or disprove the hypothesis
- Practical constraints (time, resources, access)
 
Ask the user which assumptions they want to validate first if unclear.
 
### 4. Measurement Plan
*How will we know if our solution delivers the expected value? What metrics will we track?*
 
Define:
- What metrics indicate success
- How metrics will be captured
- Baseline values (if known) or how to establish them
- Success thresholds (if the user can define them)
 
### 5. Results
*What did we learn from the experiment? What worked, what didn't?*
 
Leave this section as "(To be completed after experiment)" when drafting the proposal.
 
### 6. Next Actions
*Every completed experiment should identify its outcome path. This closes the loop between learning and impact.*
 
Leave this section as "(To be completed after experiment)" when drafting the proposal.
 
When closing out an experiment, choose one or more of the following outcome paths:
 
**Project Proposal** — The experiment produced results that warrant further work by Skunkworks. What is the proposed project? This could become a new side-quest or evolve into a moonshot. Follows the normal intake and bucketing process.
 
When writing a Project Proposal outcome:
- Describe the proposed project scope clearly
- Indicate whether it's side-quest or moonshot scale
- Reference specific findings that justify further work
- Note any dependencies or prerequisites
 
**Surface** — The experiment produced actionable findings for someone outside Skunkworks. Identify the specific team or person the results are being surfaced to, and include a clear recommendation for what they should do with it. Some experiments originate from Product or other teams — in those cases, the results go back to the requester with findings they can act on.
 
When writing a Surface outcome:
- Name the specific team, person, or role receiving the findings
- Write a clear, actionable recommendation (not just "consider doing X")
- Explain what the recipient should do and why
- Note if the experiment originated from that team/person
 
**Dead End** — The results did not produce anything worth acting on. Document what was learned and why it's a dead end. This is a valid and valuable outcome — killing ideas early is part of why we experiment.
 
When writing a Dead End outcome:
- Explain what was learned despite the dead end
- State why further work isn't warranted
- Note any conditions that might reopen the question in the future
 
Not every experiment will have a single exit. An experiment might surface findings to one team while also spawning a follow-up project. Each outcome path should be identified separately.
 
## Writing Guidelines
 
- Use clear, direct language
- Avoid jargon unless domain-appropriate
- Do not invent metrics, statistics, or dollar amounts
- Use directional outcomes ("reduces cost," "eliminates step") rather than fabricated specifics
- Ask clarifying questions if context is insufficient
- Keep each section focused on its purpose
 
## Evaluation Criteria
 
Proposals are evaluated on three lenses:
1. **Business Impact** - Does it save/make money or improve quality/velocity?
2. **Validated Need** - Was it observed directly or explicitly requested?
3. **Adoption Path** - Is the team ready to adopt? What's the timeline?
 
Ensure the proposal addresses these implicitly through its content.
 
## Output Format
 
Present the proposal with clear section headers:
 
```
## Experiment Proposal: [Title]
 
### 1. Observation
[content]
 
### 2. Hypothesis
[content]
 
### 3. Experiment
[content]
 
### 4. Measurement Plan
[content]
 
### 5. Results
(To be completed after experiment)
 
### 6. Next Actions
(To be completed after experiment)
```
 
When closing out an experiment, the Next Actions section should look like:
 
```
### 6. Next Actions
 
**Outcome Path: [Project Proposal | Surface | Dead End]**
 
[For Project Proposal]: Description of proposed project, scope, and how it enters intake.
[For Surface]: Who receives the findings, what the recommendation is, and what they should do.
[For Dead End]: What was learned and why further work isn't warranted.
```
