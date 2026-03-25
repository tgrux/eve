---
name: create-my-packing-list
description: create a packing list for me and/or my family for a trip
---

# Create My Packing List

## When to use this skill

- Use this skill to crate a packing list for a trip for the user (Tim)
- User this skill to create a packing list for a trip for the entire family.

## How to use this skill
This skill creates a packing list by gathering information from the user and combining with reference data and a markdown template that should be written to Obsidian using an Obsidian MCP tool.  If the MCP tool does not exist, ask the user what to do.

### Gather Information First

Ask the following questions and get the answers.
1. What date and time are they leaving?
2. What date and time are they getting back home?
3. What is the destination
4. What is the high/low temperature at the destination
5. Will it be raining/snowing?
6. Will they be swimming?
7. Do they want to do running workouts?
8. Do they want to go to the gym?
3. What type of trip is it? See [Trip types](#trip-types) section below for options.

### Create the list

1. Based on the trip type, get the related packing list.
2. Extrapolate the packing list based on the length of the trip.
3. Use the [packing list template](assets/packing-list-template.md) to generate a formatted packing list.  Placeholders in the template have brackets around them.

## Trip Types

### How to read a trip type file
Trip type files are markdown files, formatted with section headers.  The section headers clarify what the items are for as well as additional information to determine if it should be used.  For example:

`## Cool Weather Clothing for 1 day` indicates these items are for a trip that has cold weather and are what I would need for one day.  If I"m going on a trip for three days, items on the list with a `x1` at the end would be updated to have a `x3`.  Items for a single day can have any number too, for example something with an `x2`, next to it, would be multiplied by three for a three day trip, so would be `x6`.

`## Health` indicates it should always be added and does not need multiplied since no days are specified.

`## Notes` header is not a list, it should simply be included at the bottom of the list.

### Available trip type files 

#### Work
Work trips require minimal packing and usually include a flight.
- use the personal-list-work.md list to know what I need to pack for a work trip.

#### Camper
Camper trips are usually a family trip and use our family F150 2022 Lariat V6 4x4 + Apex Nano BH210 camper.
- use the personal-list-work.md list to know what I need to pack for a work trip.