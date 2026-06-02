import json, re

# Load questions.js
with open("questions.js", "r", encoding="utf-8") as f:
    content = f.read()

parts = content.split("const CCAF_DATABASE = ")
data_str = parts[1].split("// Pre-processing to attach stable option IDs")[0].strip()
if data_str.endswith(";"):
    data_str = data_str[:-1]

existing_qs = json.loads(data_str)
print(f"Loaded {len(existing_qs)} from questions.js")

# Check how many of practical_test_en.html are in existing_qs
with open("scratch/claude-certified-architect/practical_test_en.html", "r", encoding="utf-8") as f:
    html = f.read()

parts = html.split("const QUESTIONS = ")
json_str = parts[1].split("const state = ")[0].strip()
if json_str.endswith(";"):
    json_str = json_str[:-1]
q_test = json.loads(json_str)

def norm(text):
    return re.sub(r"\s+", " ", text.lower()).strip()

matches = 0
for q in q_test:
    sit = q["situation"]
    sit_norm = norm(sit)
    found = False
    for eq in existing_qs:
        if sit_norm[:40] in norm(eq["scenario"]):
            found = True
            break
    if found:
        matches += 1

print(f"Matches between practical_test_en.html and questions.js: {matches}/{len(q_test)}")
