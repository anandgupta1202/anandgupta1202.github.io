---
title: "RAG, Explained for Engineers Who Actually Have to Build It"
description: "A production-minded guide to RAG trade-offs across chunking, embeddings, vector search, retrieval, generation, and evaluation."
pubDate: 2026-07-02
updatedDate: 2026-07-02
tags: ["RAG", "LLM", "Vector Search", "ML Engineering"]
source: "anandgupta.net"
pinned: true
featuredRank: 1
draft: true
heroImage: "./rag-stack-of-tradeoffs.png"
heroAlt: "RAG is a stack of trade-offs between retrieval quality, latency, and cost."
---

Every RAG system looks clean in a diagram.

Query in. Context retrieved. Answer out.

Then production happens.

The chatbot confidently cites the wrong policy. Latency doubles after someone adds a reranker. Users ask simple questions and get irrelevant chunks. The team starts debating vector databases, prompt templates, and whether they should “just increase top-k.”

Only when you look at each component you realise that **RAG is not a pipeline. It is a stack of trade-offs pretending to be a pipeline.**

Most tutorials skip that part. They show you the happy path: split documents, embed chunks, store vectors, retrieve context, generate an answer. The diagram is accurate. It is also useless if you are the engineer responsible for making the system work after the demo.

In production, the real work is deciding:

- What chunk size should you use?
- Which embedding model is good enough for your domain?
- When is hybrid search worth it?
- When do you add a reranker?
- How do you know retrieval is working?
- What breaks when latency, cost, and quality start fighting each other?

This is the guide I wish had existed before I had to reason through those decisions myself.

My article will not give you one universal answer because there is no such thing. It will give you the actual decisions, the trade-offs behind them, and the defaults I would use if I had to ship a RAG system next week without embarrassing myself in production.

---

## When This Guide Is Useful

Use this when:

- You are designing your first production RAG system
- Your demo works but real users are getting weak answers
- Your team is debating chunk size, vector databases, reranking, or top-k
- Retrieval quality feels inconsistent and nobody can prove why
- You are preparing for a RAG/system-design interview
- Someone says “let’s just increase top-k” and everyone nods

If your team is debating infrastructure before building an eval set, send them this article and save everyone three weeks.

---

## The Pipeline in One Breath

Seven stages. Three forces.

```text
Chunking → Embeddings → Vector Index → Query Transformation → Retrieval → Generation → Evaluation
```

Every meaningful RAG decision lives somewhere inside this triangle:

```text
Retrieval Quality ↔ Latency ↔ Cost
```

Improving one usually taxes another.

- Better retrieval often means more candidates, hybrid search, or reranking → more latency.
- Lower latency often means fewer candidates or simpler models → worse recall.
- Lower cost often means smaller embeddings, cheaper infra, or fewer LLM calls → weaker quality.

A good RAG system is not one where every component is “best.” It is one where every trade-off is deliberate.

---

## A Production Failure Story You Will Eventually See

A team launches RAG over internal documentation.

The demo is impressive. Ask a question, get a fluent answer, cite a source. Leadership is happy.

Two weeks later, support tickets start coming in.

- The right document exists, but the system retrieves the wrong section.
- Some answers are technically grounded but miss the point.
- Latency is fine until the team adds reranking, then it becomes painful.
- Evaluation is “manual vibes” because nobody built a golden set.

The team blames the LLM. Then the vector database. Then the prompt.

The real problems are more boring:

- Chunks are too large, so embeddings match vague blobs instead of precise facts.
- Metadata filters were added too late, so permissions and document scopes are messy.
- Domain terms are not handled well by the embedding model.
- Nobody knows whether Recall@k improved or got worse after each change.

Most RAG failures are not architectural failures.

They are measurement failures wearing an architecture costume.

---

## Stage 1: Chunking — The Decision That Breaks Everything Quietly

Chunking is how you split source documents into pieces the retrieval system can search.

It sounds like plumbing. It is not. It is one of the highest-leverage decisions in the whole system.

The core tension:

**Small chunks give precise retrieval but lose context. Large chunks preserve context but create noisy retrieval.**

A 100-token chunk may match a query very specifically, but it might not include the surrounding explanation needed to answer correctly.

A 2000-token chunk may preserve the full section, but the embedding now represents too many ideas at once. It starts matching everything and nothing.

![Chunking trade-off: small chunks improve precision, large chunks preserve context, and parent-document retrieval gets both.](/blog/images/rag-explained-for-engineers/02-chunking-precision-vs-context.png)

### Common chunking strategies

| Strategy | What it is | When to use it |
|---|---|---|
| Fixed-size with overlap | Split every N tokens with overlap | Fast baseline; good first implementation |
| Recursive splitting | Prefer paragraphs/sentences before falling back to character limits | Better default for prose and documentation |
| Semantic chunking | Split where meaning shifts using embeddings | Higher quality; slower and more expensive indexing |
| Structure-aware chunking | Respect headers, lists, tables, sections | Best for manuals, policies, clinical guidelines, API docs |

### The pattern most teams should know earlier

**Parent-document retrieval.**

Index small chunks for precision. When a small chunk matches, return its larger parent section for context.

You get:

- Small-chunk precision during search
- Larger-context usefulness during generation

This is especially valuable when context richness matters: clinical content, legal text, technical docs, policy documents, and anything where one sentence alone is not enough.

### My default

Start with:

```text
Recursive splitting
512 tokens
128 token overlap
```

It is not glamorous. It is a solid baseline.

Do not spend weeks optimising chunking before you have eval data. Without representative queries, you are just tuning vibes.

### Mistake to avoid

Do not set chunk size once during setup and treat it as permanent.

Your query distribution determines your chunking strategy. You only learn that through evaluation.

---

## Stage 2: Embeddings — Your Model Does Not Know Your Domain

Embeddings turn text into vectors that can be searched by similarity.

The embedding model you choose matters more than most engineers expect, especially outside general-domain text.

### Dense vs sparse retrieval

| Type | Strength | Weakness |
|---|---|---|
| Dense embeddings | Semantic similarity; “cardiac discomfort” can match “chest pain” | Can miss exact terms and IDs |
| Sparse search / BM25 | Exact keyword matching; strong for names, acronyms, codes | Weak at conceptual similarity |

Neither is universally better. Production systems often combine both later through hybrid search.

At this stage, choose your dense embedding model and make sure you can measure whether it works.

### Dimensions and cost

Higher-dimensional embeddings usually improve recall but increase:

- Storage cost
- Index size
- Query latency
- Memory requirements

For example, `text-embedding-3-large` at 3072 dimensions is strong, but Matryoshka-style truncation to 256 dimensions can be dramatically cheaper while still being usable.

Know what you are optimising for before paying for quality you may not need.

### The domain gap

This is where many deployed RAG systems start to look stupid.

General embedding models are trained on general text. Your corpus may not be general.

Clinical terms, legal phrases, financial acronyms, internal product names, abbreviations, and company-specific jargon can all break retrieval.

Example:

```text
“PRN medication” ≈ “as-needed medication”
```

A clinical model may understand that. A generic model may not.

If retrieval fails on domain-specific queries, check embeddings early.

![Embedding models can miss domain language; hybrid search and domain-aware evaluation catch these blind spots.](/blog/images/rag-explained-for-engineers/03-domain-embedding-blind-spots.png)

Options:

- Switch to a domain-adapted model
- Fine-tune embeddings on your corpus
- Add synonym-rich metadata to chunks as a cheaper first test
- Use hybrid search so exact terms still matter

### My default

Start with a strong general model:

```text
text-embedding-3-large
or
bge-large-en-v1.5
```

Then run evaluation on domain-specific queries early.

Do not fine-tune embeddings before you have evidence that the current model fails systematically.

### Versioning trap

Changing your embedding model means re-embedding the corpus.

Chunks indexed under Model A cannot be safely searched with Model B.

Build versioning and migration into the indexing pipeline from day one:

- embedding model name
- embedding dimension
- chunking strategy version
- indexed timestamp
- source document version

This sounds obvious. Teams still get caught by it.

---

## Stage 3: Vector Database — Most Teams Over-Engineer This

A vector database stores embeddings and performs approximate nearest-neighbour search.

At small and medium scale, this is usually not the hardest part of RAG. Teams often make it the hardest part because infrastructure choices feel more concrete than evaluation choices.

### Index types

| Index | What it gives you | Best for |
|---|---|---|
| Flat | Exact brute-force search, perfect recall | Small corpora under ~100k vectors |
| HNSW | Fast, high-recall, RAM-resident ANN | Default production choice for many systems |
| IVF | Disk-friendly, scalable to large corpora | Tens of millions of vectors when RAM is constrained |
| PQ | Vector compression | Very large corpora where cost matters more than recall |

### Common options

| Option | Use it when |
|---|---|
| `pgvector` | You already use Postgres and have fewer than ~10M vectors |
| Qdrant / Weaviate | You need stronger vector-native features, metadata filtering, or hybrid search |
| Pinecone | You want managed infra and are willing to pay for convenience |
| FAISS | You need fast offline or research workflows, not a full production service |

### What people miss

Metadata filtering.

Your vector search is only as useful as your ability to scope it.

Real systems need filters like:

- only documents this user can access
- only clinical guidelines updated after 2022
- only documents from this product area
- only chunks from a certain jurisdiction, tenant, or source type

That metadata must exist at indexing time.

Adding it later often means re-indexing everything.

### My default

Use:

```text
pgvector if corpus < 10M vectors and requirements are simple
Qdrant if you need richer vector-native retrieval or hybrid search
```

Do not start with expensive managed vector infrastructure unless avoiding ops is genuinely worth the cost.

---

## Stage 4: Query Transformation — Useful, But Not Free

Query transformation means modifying the user’s raw query before retrieval.

The idea is simple: users phrase things badly, and better search queries retrieve better context.

### Common techniques

| Technique | What it does | Cost |
|---|---|---|
| Query rewriting | Cleans up vague or messy user queries | Extra LLM call |
| Multi-query | Generates 3–5 query variants and merges results | More retrieval work + usually LLM cost |
| HyDE | Generates a hypothetical answer, embeds that, and searches with it | Extra LLM call; often improves conceptual QA |
| Decomposition | Splits complex questions into sub-queries | Multiple retrieval passes |
| Step-back prompting | Retrieves general background before the specific answer | Extra retrieval/generation work |

### The cost nobody should ignore

Every transformation adds latency, money, or both.

It may improve quality. It may also make your product feel slow.

Do not add it because a blog post said it improves RAG. Add it because your eval set shows query phrasing is the bottleneck.

### My default

Skip query transformation in v1.

Most early retrieval failures come from:

- bad chunking
- weak embeddings
- missing metadata
- no hybrid search
- no eval set

Not from insufficiently fancy query rewriting.

Exception: if your product handles conceptual, knowledge-heavy questions — “what causes X?”, “how does Y work?”, “why does Z happen?” — HyDE is worth a targeted experiment.

---

## Stage 5: Retrieval — The Two-Stage Pattern

Basic vector search retrieves the top-k chunks most similar to the query.

It is fast and often gets the right answer somewhere in the top results.

The problem is ranking.

The correct chunk may be in the top-20, but not in the top-3. Generation quality depends heavily on what makes it into the final context.

### Hybrid search

Hybrid search combines:

- dense vector retrieval for semantic similarity
- sparse/BM25 retrieval for exact terms

Then it merges the results, often with Reciprocal Rank Fusion (RRF).

This is especially useful for:

- technical docs
- named entities
- IDs and codes
- clinical/legal/financial terminology
- internal company jargon

Dense retrieval understands meaning. Sparse retrieval respects exact language. You usually want both.

### Cross-encoder reranking

A reranker looks at the query and candidate chunk together, then scores relevance more accurately.

Typical flow:

1. Retrieve top-50 candidates quickly
2. Rerank those 50 with a cross-encoder
3. Send top-3 or top-5 to the generator

This improves precision but adds latency, often 200–600ms or more depending on model and infra.

### The production-grade pattern

```text
Fast ANN over full index → top-50 candidates
Cross-encoder reranker → top-3 final chunks
Generator answers from final context
```

This gives you broad recall first, then precision.

![Two-stage retrieval flow: fast ANN or hybrid search returns top-50 candidates, a reranker selects final context, and the generator cites grounded answers.](/blog/images/rag-explained-for-engineers/04-two-stage-retrieval.png)

### My default

Implement hybrid search before query transformation.

Add reranking when:

- your eval set shows the right chunk appears in top-20 but not top-3
- your latency budget can absorb it
- the answer quality improvement is worth the extra complexity

In serious production systems, reranking is usually worth it. Just do not add it blindly.

---

## Stage 6: Generation — Where RAG Quietly Fails

Retrieval can find the right content and generation can still produce the wrong answer.

This is the part people underestimate because the generated answer often sounds confident.

Confidence is not faithfulness.

### Context ordering matters

LLMs are vulnerable to “lost in the middle”: they pay more attention to content near the beginning and end of the context window.

If you retrieve three chunks, put the most relevant chunk first.

Small change. Real impact.

### Grounding instructions are cheap and useful

Use explicit instructions:

```text
Answer only from the provided context.
If the context does not support an answer, say:
“I don’t have enough information to answer that.”
Do not use information from training data.
```

This is one of the cheapest faithfulness improvements available.

It costs no extra retrieval step, no extra model call, and no new infrastructure.

### Citations are worth it

Citations force the system to expose where claims came from.

They help with:

- user trust
- debugging
- auditability
- hallucination detection
- compliance-sensitive workflows

They add token overhead, but in most production RAG systems they are worth it.

### Faithfulness checks

A post-generation check asks another model call:

> Is this answer actually supported by the retrieved context?

This can be valuable in high-stakes domains like medical, legal, finance, or compliance.

But it adds latency and cost.

Use it when the cost of a wrong answer is higher than the cost of a slower answer.

### My default

Start with:

- strong grounding instructions
- explicit abstention behavior
- citations
- relevance-ordered context assembly

Add post-generation faithfulness checks only when the use case justifies the latency.

---

## Stage 7: Evaluation — The Thing You Will Skip and Regret

Evaluation is the part most teams postpone until the system embarrasses them.

That is backwards.

Without evaluation, every RAG improvement is a guess.

![RAG evaluation loop: golden eval set, retrieval metrics, generation checks, and CI gates make the system measurable.](/blog/images/rag-explained-for-engineers/05-eval-control-system.png)

### Why similarity scores are not enough

Cosine similarity is not a quality metric.

A chunk can be close in embedding space and still be useless for answering the question.

You need ground truth.

### Retrieval metrics

| Metric | What it tells you |
|---|---|
| Recall@k | Did the correct chunk appear somewhere in the top-k? |
| NDCG | Was the correct chunk ranked near the top? |
| MRR | How high was the first correct result? |

Start with Recall@k. If the correct chunk is not retrieved, generation cannot save you.

### Generation metrics

RAGAS-style metrics are useful here:

| Metric | What it checks |
|---|---|
| Faithfulness | Does the answer stay grounded in retrieved context? |
| Answer Relevance | Does the answer address the question? |
| Context Precision | Were retrieved chunks actually useful? |
| Context Recall | Did retrieved context contain what was needed? |

### Build a golden eval set

You need 50–200 representative question-answer pairs with correct source chunks labeled.

Use:

- real user queries if available
- expected query patterns if not
- edge cases from domain experts
- known failure modes

Then make it part of CI.

A regression in Recall@k should block deployment just like a failing unit test.

Yes, this is expensive to build.

It pays for itself the first time it catches a retrieval regression before users do.

### Online eval

Offline eval tells you whether known cases work.

Online eval tells you whether real users are satisfied.

Useful signals:

- thumbs up/down
- answer edits
- repeated queries
- escalation to human support
- citation clicks
- “I don’t know” rates

When available, online feedback closes the loop between lab quality and production quality.

### My default

Build at least 50 golden eval pairs before optimising anything.

If you do not have eval data, you are not tuning a RAG system.

You are guessing with infrastructure.

---

## The “Don’t Embarrass Yourself in Production” RAG Stack

If I had to start from scratch, these are the defaults I would use:

| Stage | Default choice |
|---|---|
| Chunking | Recursive splitting, 512 tokens, 128 overlap |
| Embeddings | `text-embedding-3-large` or `bge-large-en-v1.5` |
| Vector DB | `pgvector` under 10M vectors; Qdrant beyond that or for richer retrieval |
| Metadata | Store source, permissions, document version, section, timestamp, and chunk strategy |
| Query transformation | Skip in v1 |
| Retrieval | Hybrid search: dense + BM25, merged with RRF |
| Reranking | Add when eval shows top-k recall is good but final ranking is weak |
| Generation | Grounding + abstention instructions; most relevant chunk first |
| Citations | Include by default |
| Eval | 50+ golden pairs before serious optimisation |

These are not the best settings for every use case.

They are the settings that give you a working, measurable system you can improve deliberately.

![Default production RAG stack: practical baseline choices for chunking, embeddings, vector DB, retrieval, reranking, generation, citations, and evals.](/blog/images/rag-explained-for-engineers/06-default-rag-stack.png)

---

## The RAG Build Checklist

Before you call your RAG system production-ready, ask:

- [ ] Do you have at least 50 golden eval queries?
- [ ] Are correct source chunks labeled for those queries?
- [ ] Have you tested chunk sizes against actual queries?
- [ ] Are embedding model versions tracked?
- [ ] Can you re-embed and migrate safely?
- [ ] Do chunks include metadata for permissions, source, document version, and section?
- [ ] Are you measuring Recall@k before blaming generation?
- [ ] Have you tried hybrid search for technical or named-entity-heavy queries?
- [ ] Do you know your latency budget before adding reranking?
- [ ] Are retrieved chunks ordered deliberately in the prompt?
- [ ] Can the model abstain when context is insufficient?
- [ ] Are answers cited?
- [ ] Do you monitor online feedback after launch?

If you cannot answer these, your system may still be a demo.

That is fine. Just do not confuse it with production.

---

## The Real Work

RAG is not a solved problem you install.

It is a retrieval system you continuously measure.

The pipeline diagram is the beginning, not the answer. What makes RAG work in production is everything the diagram hides: the chunking decisions, the embedding trade-offs, the metadata discipline, the reranking latency, the grounding constraints, and the eval set that tells you whether any of it helped.

The teams that win with RAG are not the ones with the fanciest vector database.

They are the ones who can answer one boring question every week:

**Did retrieval get better or worse?**

If you cannot answer that, you are not building a RAG system.

You are running a demo and hoping production is kind.

Build the eval set first.

Everything else follows from that.
