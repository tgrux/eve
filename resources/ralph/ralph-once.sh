#!/bin/bash

claude --permission-mode acceptEdits "@spec/requirements.md @progress.txt \
1. Read the requirements and progress file. \
2. Find the next incomplete task and implement it. \
3. Commit your changes. \
4. Update progress.txt with what you did. \
ONLY DO ONE TASK AT A TIME."
