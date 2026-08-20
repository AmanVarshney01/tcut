## ADDED Requirements
### Requirement: Captions
`t.print(markdown)` SHALL render Markdown to ANSI and write it into the recording and the screen model without sending anything to the PTY, then obtain a fresh prompt; `t.title(text)` SHALL render a heading and rule followed by a pause. Captions SHALL appear in every output format because they are ordinary terminal output in the cast.
#### Scenario: caption then command
- **WHEN** a script calls `t.print("## Step 1")` and then `t.run("ls")`
- **THEN** the video shows the bold heading above the command, the shell never receives "Step 1", and `ls` runs at a normal prompt
