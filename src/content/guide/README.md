# The guide

Each Markdown file here is one topic. It appears in two places:

- **In the app**, behind the "?" beside a field or heading. The whole file opens there, so keep it short: one to three paragraphs, or a short list.
- **On the guide page**, at `/guide`, with every topic in its section.

## Editing

Change the text below the `---` lines and save. Plain Markdown works: paragraphs, `**bold**`, lists and links.

Each file starts with:

```yaml
---
title: House system # The topic's heading
order: 1 # Its place in its section on /guide
---
```

## Folders

Each folder is a section on `/guide`:

- `birth-details/`: Birth details
- `settings/`: Chart settings
- `chart/`: Reading the chart
- `chart-types/`: Other charts

## Adding or renaming a topic

The app finds topics by their path, such as `settings/house-system`. To add, rename or remove a file, also update `GuideTopic` in `src/components/guide/topics.ts`. A test fails until the two match.
