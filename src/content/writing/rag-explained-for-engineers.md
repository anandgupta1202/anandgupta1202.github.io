---
title: "RAG, Explained for Engineers Who Actually Have to Build It"
description: "A production-minded guide to RAG trade-offs across chunking, embeddings, vector search, retrieval, generation, and evaluation."
pubDate: 2026-07-02
updatedDate: 2026-07-19
tags: ["RAG", "LLM", "Vector Search", "ML Engineering"]
source: "anandgupta.net"
pinned: true
featuredRank: 1
draft: false
heroImage: "./rag-stack-of-tradeoffs.png"
heroAlt: "RAG is a stack of trade-offs between retrieval quality, latency, and cost."
---

Every RAG system looks clean in a diagram. Query in. Context retrieved. Answer out.
Look inside, though, and it's the opposite of a black box.

**RAG is a stack of trade-offs. It is a pipeline where each component needs to be optimized.**

Most tutorials skip that part and show you the happy path: split documents, embed chunks, store vectors, retrieve context, generate an answer. The diagram is accurate. It is also useless if you are the engineer responsible for making the system work after the demo.

In production, depending on the usecase you need to decide:

- What chunk size should you use?
- Which embedding model is good enough for your domain?
- When is hybrid search worth it?
- When do you add a reranker?
- How do you know retrieval is working?
- What breaks when latency, cost, and quality start fighting each other?

This is the guide I wish had existed before I had to reason through those decisions myself.

My article is not the one universal answer because there is no such thing, but this article will help you make the actual decision, the trade-offs behind them, and the defaults I would use if I had to ship a RAG system next week without embarrassing myself in production.

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

![Demo RAG looks clean; production RAG exposes permissions, latency, cost, and evaluation problems.](/blog/images/rag-explained-for-engineers/07-demo-vs-production-rag-xiaohei.png)

---

## The Pipeline in One Breath

In a general sense, the RAG pipeline can be decomposed into seven stages.

```text
Chunking → Embeddings → Vector Index → Query Transformation → Retrieval → Generation → Evaluation
```

And every meaningful RAG decision lives somewhere inside this triangle:

```text
Retrieval Quality ↔ Latency ↔ Cost
```

Improving one usually taxes another.

- Better retrieval often means more candidates, hybrid search, or reranking → more latency.
- Lower latency often means fewer candidates or simpler models → worse recall.
- Lower cost often means smaller embeddings, cheaper infra, or fewer LLM calls → weaker quality.

Each of these trade-offs need to be thought through before building the pipeline.

---

## Most Common Production Failure Story

Let me describe a scenario that I have seen happen over and over again.

You or your team launches RAG over internal documentation. The demo is impressive. If you ask a question, you get a fluent answer which cites a source. The leadership is happy with the POC implementation.

Then two weeks go by and support tickets have already piled up. You attempt to understand what went wrong and probably find one or a combination of these issues:

- The right document exists, but the system retrieves the wrong section.
- Some answers are technically grounded but miss the point.
- Latency was fine till the team added reranking, then it became painful.
- Evaluation is “manual vibes” because nobody built a golden set.

While writing the incident report it might look like that the issue is with the LLM, or the vector database or the prompt. But if you dig deeper the real problems are more mundane:

- Chunks are too large, so embeddings match vague blobs instead of precise facts.
- Metadata filters were added too late, so permissions and document scopes are messy.
- Domain terms are not handled well by the embedding model.
- Nobody knows whether Recall@k improved or got worse after each change.

So, let us attempt to breakdown each concept and understand in detail.

---

## Stage 1: Chunking — The Decision That Breaks Everything Quietly

By now you must know that LLMs need to see relevant pieces of information or facts to generate an answer to your specific question. Now imagine you have a large document, or say, even a small document with a lots of diverse information. How do you make sure that the LLM sees only the relevant pieces and ignores the rest. One of the ways is to feed all the information to the LLM in the prompt and pray that it understands the specific parts needed to answer your question.

The better approach would be to divide all the information into smaller pieces **or chunks** and create a system to surface only the most important and relevant chunks. Chunking is the process of how you split source documents into pieces the retrieval system can search. Honestly, it is one of the highest-leverage decisions in the whole system.

So lets see what's the key thing we need to consider and which trade-offs is coupled with that decision:

To chunk a document we need to decide the size of each chunks, and the thing to keep in mind is **Small chunks give precise retrieval but lose context. Large chunks preserve context but create noisy retrieval.**

What I mean by that is a 100-token chunk may match a query very specifically, but it might not include the surrounding explanation needed to answer correctly. While a 2000-token chunk may preserve the full section, but the embedding now represents too many ideas at once. It starts matching everything and nothing.

![Chunking trade-off: small chunks improve precision, large chunks preserve context, and parent-document retrieval gets both.](/blog/images/rag-explained-for-engineers/02-chunking-precision-vs-context.png)

### Common chunking strategies

The simplest strategy is fixed-size chunking with overlap. You take the document, split it every N tokens, and carry some tokens forward into the next chunk so that sentence boundaries do not get completely destroyed. This is a good first implementation because it is predictable and easy to debug. It is also crude. It does not know whether it is splitting a paragraph, a table, a policy clause, or a code sample.

Recursive splitting is usually the better default for prose and documentation. Instead of blindly cutting at a token limit, you try to preserve natural boundaries first: headings, paragraphs, sentences, then smaller units only when needed. The result is not automatically better than the strategy before, but it tends to create chunks that still feel like pieces of a document, where each chunk makes sense individually.

Semantic chunking goes one step further. It tries to split where the meaning shifts, often using embeddings or similarity between adjacent passages. This can produce cleaner retrieval units, especially in messy long-form documents, but it makes indexing slower and more expensive. I would not start here unless the corpus is valuable enough and your evals show that simpler splitting is failing.

Structure-aware chunking is what you want when the document structure carries meaning. Manuals, policies, clinical guidelines, API docs, financial reports, and legal documents often depend on headers, lists, tables, and sections. If you flatten all of that into arbitrary token windows, you throw away useful signals before retrieval even begins.

Quick snapshot:

| Strategy | What it is | When to use it | Code example |
|---|---|---|---|
| Fixed-size with overlap | Split every N tokens with overlap | Fast baseline; good first implementation | [LangChain token splitter](https://docs.langchain.com/oss/python/integrations/splitters/split_by_token) |
| Recursive splitting | Prefer paragraphs/sentences before falling back to character limits | Better default for prose and documentation | [LangChain recursive splitter](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter) |
| Semantic chunking | Split where meaning shifts using embeddings | Higher quality; slower and more expensive indexing | [LlamaIndex semantic splitter](https://developers.llamaindex.ai/python/framework-api-reference/node_parsers/semantic_splitter/) |
| Structure-aware chunking | Respect headers, lists, tables, sections | Best for manuals, policies, clinical guidelines, API docs | [LangChain Markdown splitter](https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter) |

### The pattern most teams should know earlier

The most useful pattern here is parent-document retrieval.

You index small chunks because small chunks make search precise. A query about refund eligibility should match the paragraph about refund eligibility, not all FAQs around refunds in general. But once that small chunk matches, you do not have to send only that small chunk to the LLM. You can return the larger parent section around it. Lets say, you also send the full heading, neighboring paragraphs, table, policy clause, or document section with the matching chunk. **That is how search gets precision and generation gets context.**

This matters whenever one sentence is not enough to answer safely. Clinical content, legal text, technical documentation, policy documents, and compliance-heavy material often need the surrounding explanation. Parent-document retrieval gives you a practical way to avoid the false choice between tiny chunks that lose context and huge chunks that retrieve poorly.

Code examples and articles worth checking out:
[LangChain `ParentDocumentRetriever`](https://reference.langchain.com/python/langchain-classic/retrievers/parent_document_retriever/ParentDocumentRetriever) and this [MongoDB + LangChain parent-document retrieval tutorial](https://www.mongodb.com/docs/atlas/ai-integrations/langchain/parent-document-retrieval/).

---

## Stage 2: Embeddings — Your Model Does Not Know Your Domain

Chunking decides which parts of text becomes searchable. Embeddings decide what **similar** means.

Before we talk about the best techniques, lets talk about what happens when the embedding layer is sub-optimal. In worst cases like these, you will see that the right chunk exists and even though the user asks a reasonable question the retrieval does not see the relevant chunk. As a result, the LLM never sees the right context, so it either gives a weak answer or confidently answers from the wrong source.

Often times, we look to optimize the prompt or the vector database and sometimes those may be the issue. But many times the problem is simpler: the embedding model does not understand your domain language well enough.

Now let us understand what does embedding models do? Embedding models turn text into vectors (N-dimensional numbers).
However the main thing this enables us to do is treat your chunks as numbers in a set. Additionally you can treat user-texts or queries as numbers and search for few numbers from the set of chunks which are closest to the user text.

This however raises two important questions:
1. What are the different type of embedding models? And how does it effect how we search for similar chunks?
2. Even if let's say, the embedding model is able to generate the best and ideal vectors for each chunk, how to know which chunks are relevant to the user text.

### Dense vs sparse retrieval

Because embeddings are where dense and sparse vectors are born, this is also where we settle the dense-vs-sparse-vs-hybrid retrieval decision — even though it only pays off later, at retrieval time.

Before we talk about dense retrieval and sparse retrieval, it helps to understand the vectors themselves.

A sparse vector is mostly zeros. It usually represents which words or tokens appear in the text, and how important they are. BM25 and traditional keyword search live closer to this world. If the word `refund` appears in the document and the user searches for `refund`, sparse retrieval can match that directly. Think of it as a vector trying to encode the word rather than what it means intrinsically.

![Embedding models can miss domain language; hybrid search and domain-aware evaluation catch these blind spots.](/blog/images/rag-explained-for-engineers/03-domain-embedding-blind-spots.png)

A dense vector is different. Almost every dimension has some value, and those values are learned by a model. The dimensions do not map cleanly to individual words. Instead, the vector tries to capture meaning. That is why a dense model can place "cardiac discomfort" close to "chest pain" even when the words are different.

Dense retrieval uses dense vectors to search by meaning. You take the query, convert it into a dense vector, and search for chunk vectors that are close to it. This is useful when users do not use the same words as your documents. A user asking "Can I cancel after payment?" may retrieve a policy section titled "Refund eligibility" even if the word "cancel" is not present.

But dense retrieval is not the ideal fit for all sorts of retrieval. It can miss exact strings that matter a lot: IDs, product names, medication names, error codes, acronyms, policy numbers, and internal shorthand. Those tokens may be the whole point of the query. If a user asks about policy `ABC-123`, or a specific medication abbreviation, semantic similarity is not enough. The system needs to notice the exact token.

Sparse retrieval uses sparse vectors to search by lexical overlap. It does not understand meaning deeply, but it is very strong when the exact words matter.

That is why BM25 continues to be relevant in modern RAG systems, as it catches failures that dense embeddings regularly miss. It is especially useful for technical docs, support tickets, API references, legal documents, clinical content, financial reports, and any corpus where names, codes, and abbreviations carry real meaning.

| Type | Strength | Weakness |
|---|---|---|
| Dense embeddings | Semantic similarity; “cardiac discomfort” can match “chest pain” | Can miss exact terms and IDs |
| Sparse search / BM25 | Exact keyword matching; strong for names, acronyms, codes | Weak at conceptual similarity |

The important point is to understand what kind of question your users ask. If users mostly ask broad conceptual questions, dense retrieval may carry a lot of the system. If users ask for specific entities, policy IDs, error codes, product names, or medical terms, sparse retrieval becomes hard to ignore.

![Dense retrieval catches meaning, sparse retrieval catches exact tokens, and hybrid retrieval combines both.](/blog/images/rag-explained-for-engineers/08-dense-sparse-hybrid-xiaohei.png)

#### Hybrid Retrieval Strategy

As you saw above, we can't treat dense search as the whole retrieval strategy. Make sure you can measure when semantic similarity is helping and when exact matching would have saved you. Or you can use both smartly. The answer here is hybrid retrieval.

Use dense search to catch meaning. Use sparse search to catch exact terms. Then merge or rerank (more on that later) the candidates before sending context to the LLM.

This is especially useful when your corpus contains both normal prose and exact entities. In real systems, users do not only ask conceptual questions. They ask about policy `ABC-123`, invoice `INV-9041`, medication abbreviations, exception codes, product SKUs, internal feature names, and customer-specific language. Hybrid retrieval gives you both shots at finding the right evidence.

I almost always start with dense retrieval and keep an eye out for the evals. Then iterate with hybrid search and see if it improves the evals. If it does not, keep the simpler system.

### Dimensions and cost

Embedding dimensions are another trade-off that needs to be accounted for while architecting the RAG pipeline.

Higher-dimensional embeddings can improve recall because they have more room to represent nuance. But they also increase storage cost, index size, memory requirements, and query latency. If you have multiple millions of chunks, this becomes a real problem.

For example, [`text-embedding-3-large`](https://developers.openai.com/api/docs/models/text-embedding-3-large) at 3072 dimensions is strong, but [Matryoshka-style truncation](https://huggingface.co/blog/matryoshka) to 256 dimensions can be dramatically cheaper while still being usable.

That does not mean smaller is always better. It means you should know what you are paying for. [More dimensions often have diminishing returns](https://tianpan.co/blog/2026-05-07-vector-dimension-tax-embedding-size-cost-latency), so if a smaller embedding preserves retrieval quality on your eval set, the expensive version may not be buying you much. If the smaller embedding drops recall on critical queries, the cost saving is fake.

#### Tricks for proof of concept

If I had to ship a first version, I would start with a strong general embedding model:

```text
text-embedding-3-large
or
bge-large-en-v1.5
```

Then I would build an eval set that includes domain-specific queries early. I would include acronyms, IDs, internal terms, synonyms, abbreviations, and queries where the answer depends on finding the exact source.

If the dense model fails on exact terms, I would test hybrid search before fine-tuning. If it fails on domain synonyms or specialized language, I would test synonym-rich metadata or a domain-adapted model. Fine-tuning embeddings might be on the table, but I will only think about it if the domain is ultra niche and new and all other approaches fail.

Checklist for you:
- Start with a strong general model
- Evaluate on domain-specific queries
- Add hybrid retrieval if exact terms matter
- Try metadata or a domain-adapted model if language mismatch is systematic
- Fine-tune only when the failure pattern justifies the complexity

### Something to keep in mind - versioning

Changing your embedding model is a complete migration. Chunks indexed under Model A cannot be safely searched with Model B. The same is true when you change dimensions, chunking strategy, preprocessing, or source document versions.

So it's important to build versioning into the indexing pipeline from day one. Some of the metadata to version would be these:

- embedding model name
- embedding dimension
- chunking strategy version
- indexed timestamp
- source document version

---

## Stage 3: Vector Database — Most Teams Over-Engineer This

By this stage, you have chunks and embeddings. Now you need somewhere to store those vectors and search them quickly.

A vector database is not something that makes RAG intelligent. On the flip side, Its job is more mechanical. To store vectors, search for nearest neighbors, return candidate chunks, and apply filters so that the system only searches the right subset of data.

If you are responsible of taking care of this or deciding which vector DB to choose, my suggestion would be to not over-engineer too early. Before you debate Pinecone vs Qdrant vs Weaviate vs pgvector, try to answer these simpler questions:

- How many chunks will we actually index?
- Do we need exact search or approximate search?
- What latency do users expect?
- What metadata filters are mandatory?
- Do we need hybrid search now or later?
- Can we measure recall before changing index settings?

If you do not know those answers, the vector database choice is mostly premature optimization.

### What the vector database actually does

The simplest version of vector search is brute force. Given a query vector, compare it against every stored chunk vector, sort by similarity, and return the top results. This is exact search. It gives perfect recall, but it becomes slow as the corpus grows.

That is why production systems often use approximate nearest neighbour search. Instead of checking every vector, the index uses a data structure that searches a smaller part of the vector space. You get much faster retrieval, but you may miss some true nearest neighbours. In other words, approximate search buys latency by spending some recall.

You will find this explicitly mentioned in most DB docs. The [pgvector docs](https://github.com/pgvector/pgvector#indexing) state it directly: exact nearest neighbour search gives perfect recall, while approximate indexes trade some recall for speed. FAISS also documents this split across [Flat, HNSW, IVF, and PQ index families](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes).

#### Common index types

**Flat search** is the easiest to reason about. It compares the query against all vectors. For small corpora, this can be perfectly fine. You get exact results and fewer tuning knobs. The cost is that latency grows with the number of vectors.

**HNSW** is the default production shape for many systems. It builds a graph over vectors and searches that graph efficiently. The speed-recall trade-off is strong, but it uses more memory and has parameters like `M`, `efConstruction`, and `efSearch` that affect memory, build time, latency, and recall. FAISS describes HNSW as graph exploration that converges toward nearest neighbours quickly, with larger graph parameters improving accuracy at memory cost.

**IVF** takes a different approach. It partitions vectors into clusters or lists, then searches only some of those lists at query time. This can scale well, especially when memory is constrained, but it needs tuning. Search too few lists and recall suffers. Search too many and latency rises. `pgvector` gives the same warning for IVFFlat: more probes improve recall but cost speed.

**PQ** is about compression. Instead of storing full vectors, product quantization stores compressed representations. That helps when the corpus is very large and memory or storage cost matters. The trade-off is that compression can hurt recall, so PQ usually belongs later, when scale makes the cost problem real.

Quick snapshot:

| Index | What it gives you | Best for |
|---|---|---|
| [Flat](https://www.pinecone.io/learn/series/faiss/vector-indexes/#Flat-And-Accurate) | Exact brute-force search, perfect recall | Small corpora under ~100k vectors |
| [HNSW](https://www.pinecone.io/learn/series/faiss/vector-indexes/#Hierarchical-Navigable-Small-World-Graphs) | Fast, high-recall graph-based ANN | Default production choice for many systems |
| [IVF](https://www.pinecone.io/learn/series/faiss/vector-indexes/#Inverted-File-Index) | Partitioned approximate search | Larger corpora where tuning speed vs recall matters |
| [PQ](https://www.pinecone.io/learn/series/faiss/product-quantization/) | Vector compression | Very large corpora where memory or storage cost matters |

### Common options
If your vectors are part of an existing Postgres-backed product and the corpus is small or medium, [`pgvector`](https://github.com/pgvector/pgvector) is often the most pragmatic starting point. You keep vectors near the rest of your application data, use normal SQL, and still get exact search, HNSW, IVFFlat, and filtering.

If retrieval is becoming a core product surface, vector-native systems like [Qdrant](https://qdrant.tech/documentation/) or [Weaviate](https://docs.weaviate.io/weaviate/search) start to make more sense. They give you stronger vector-specific operations, payload indexing, [filtering](https://docs.weaviate.io/weaviate/search/filters), [hybrid retrieval](https://docs.weaviate.io/weaviate/search/hybrid), and operational patterns built around search.

Managed systems like Pinecone are not wrong. Here you pay more to offload the indexing and infrastructure work. That can be the right decision if avoiding ops is more valuable than controlling every detail.

FAISS is excellent when you want local, offline, or research-grade vector search. But it is an index library, not a full service: it does not give you auth, multi-tenancy, backups, metadata governance, or application-level lifecycle management out of the box.

Quick snapshot:

| Option | Use it when |
|---|---|
| [pgvector](https://github.com/pgvector/pgvector) | You already use Postgres and have small/medium scale retrieval needs |
| [Qdrant](https://qdrant.tech/documentation/) / [Weaviate](https://docs.weaviate.io/weaviate/search) | You need stronger vector-native features, metadata filtering, payload indexing, or hybrid search |
| [Pinecone](https://docs.pinecone.io/) | You want managed vector infrastructure and are willing to pay for convenience |
| [FAISS](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes) | You need fast offline or research workflows, not a full production service by itself |

### Metadata filtering

This is a feature that can be heavily used to optimize and control which chunks the retrieval pipeline actually evaluates on. Metadata filtering is used when you don't need to search the entire corpus for every query.

In a demo, you can embed everything and retrieve from everything. In a real product, retrieval usually needs to be scoped before similarity search or alongside it. The system should search the right subset of documents, not just the nearest vectors globally.

In actual production systems, the filters we need to search for might look like:
- count of all documents a particular type of user can access
- only clinical guidelines updated after 2022
- only documents from product area of "airpods manufacturing"
- all chunks from a certain jurisdiction, tenant, or source type

This metadata needs to exist at indexing time, which helps in retrieval quality, permissions, freshness, and safety.

For example, a user may ask a perfectly valid question, but the system should only retrieve documents from their tenant. A clinical assistant may need to retrieve only the latest guideline. A legal assistant may need to restrict results to a jurisdiction. A support assistant may need to search only documents for the relevant product line.

To improve on performance issues, [Qdrant recommends payload indexes](https://qdrant.tech/documentation/manage-data/indexing/#payload-index) for fields you plan to filter on because a vector index speeds up vector search, while payload indexes speed up filtering. [Pinecone's metadata filtering docs](https://docs.pinecone.io/guides/search/filter-by-metadata) show the same operational idea, which is that search can be narrowed to records matching metadata expressions.

Adding metadata later often means re-indexing everything. That is why metadata schema design belongs in the ingestion pipeline from the start.

### Trade-offs to understand

In the vector database stage of the pipeline, we need to consider the most amount of trade-offs.

**Exact vs approximate search.** Exact search is simple and gives perfect recall, but it gets expensive as the corpus grows. Approximate search is faster, but you need to measure whether it still retrieves the evidence your eval set expects.

**Recall vs latency.** ANN indexes have knobs that change how much of the index gets searched. In HNSW, parameters like `efSearch` affect search depth. In IVF, probes control how many partitions are searched. Higher settings usually improve recall and increase latency.

**Memory vs cost.** HNSW can be fast, but graph indexes can use significant memory. PQ and quantization reduce memory and storage, but compression can hurt recall. The right answer depends on corpus size, latency target, and how expensive missed context is for your product.

**Filtering vs speed.** Metadata filters make retrieval safer and more relevant, but if the filter is applied after approximate search, you may retrieve too few usable candidates. This issue might be also addressed with iterative scans, partial indexes, or partitioning depending on the workload.

**Operational simplicity vs control.** Managed systems reduce ops work. Self-hosted or database-integrated options give more control. Neither is universally better. The right choice depends on who will operate the system after launch.

### How to work and approach VectorDB

Here is the practical sequence I would follow.

First, write down the retrieval constraints before choosing the database. Corpus size, expected growth, latency target, metadata filters, tenancy model, update frequency, and whether hybrid search matters should be explicit.

Second, start with the simplest database that satisfies those constraints. If the product already runs on Postgres and the retrieval workload is modest, start with `pgvector`. If metadata filtering, hybrid search, or vector-native operations are central to the product, start with Qdrant, Weaviate, or a managed vector DB.

Third, build the ingestion schema carefully. Store source document ID, chunk ID, document version, embedding model, chunking version, access scope, tenant, timestamp, document type, and any domain-specific filters you know you will need.

Fourth, benchmark exact search against approximate search on your eval set. Approximate search should earn its place by reducing latency without damaging recall on the queries that matter.

Fifth, tune one knob at a time. Change `top_k`, HNSW search depth, IVF probes, filter indexes, or compression settings independently.

Finally, treat the vector database as infrastructure for retrieval, not the main quality lever. Most early RAG failures still come from bad chunks, weak embeddings, missing metadata, poor ranking, or no eval set.

---

## Stage 4: Query Transformation — Useful, sometimes

Query transformation means modifying the user's raw query before retrieval.

This stage is optional. In fact, I would treat it as optional by default only because query transformation usually adds an extra step before retrieval. Sometimes that step is an LLM call. Sometimes it is multiple retrieval calls. Either way, it costs latency. If your product needs to answer users quickly, this stage may be too expensive unless it improves retrieval quality by leaps and bounds.

Though there are some cases where it is worth it (more on that later), but first let us see the types of Query Transformation.

**Query rewriting** is the process of rewriting the users query into a better or more specific pointed question. Often, users phrase things vaguely. They ask broad questions, mix multiple questions into one, use shorthand, or ask a conceptual question that does not look like the documents you indexed. In those cases, transforming the query can make retrieval much better.

For example, a user may ask:

```text
Can I get my money back if I already paid?
```

A query rewriting step may turn that into:

```text
refund eligibility after payment
```

That rewritten query may retrieve the right policy section more reliably than the raw user phrasing.

**Multi-query retrieval** does something similar but broader. Instead of trusting one rewritten query, it generates several query variants and retrieves documents for each one. LangChain's [`MultiQueryRetriever`](https://reference.langchain.com/python/langchain-classic/retrievers/multi_query/MultiQueryRetriever/) is an example of this. It uses an LLM to write a set of queries, retrieve for each, and return the unique union of documents.

**[HyDE](https://developers.llamaindex.ai/python/examples/query_transformations/hydequerytransformdemo/)** goes in a different direction. Instead of rewriting the query, it asks an LLM to generate a hypothetical answer or document, embeds that generated text, and searches with it. This can help when the user's query is too short, abstract, or far away from the language in the corpus.

**Decomposition** is useful when the user asks a compound question. If someone asks, "What changed in the 2024 policy, and does it affect enterprise customers in India?", one retrieval pass may not be enough. You may need one query for policy changes, another for enterprise customers, and another for India-specific scope. [`DecomposeQueryTransform`](https://developers.llamaindex.ai/python/framework/understanding/putting_it_all_together/q_and_a/#comparecontrast-queries) turns the original query into smaller subqueries that can be answered more easily.

**Step-back prompting** is more reasoning-oriented. Instead of retrieving only for the specific query, the system first asks a broader background question and uses that to guide the final answer. The [Step-Back Prompting paper](https://deepmind.google/research/publications/50274/) frames this as deriving higher-level concepts or principles before solving the specific question. In RAG, that can be useful for conceptual or multi-hop questions, but it is rarely something I would add to a latency-sensitive product.

Quick snapshot:

| Technique | What it does | Cost |
|---|---|---|
| [Query rewriting](https://docs.langchain.com/oss/python/langchain/retrieval#hybrid-rag) | Cleans up vague or messy user queries | Extra LLM call or preprocessing step |
| [Multi-query](https://reference.langchain.com/python/langchain-classic/retrievers/multi_query/MultiQueryRetriever/) | Generates multiple query variants and merges results | More retrieval work + usually LLM cost |
| [HyDE](https://docs.llamaindex.ai/en/v0.10.18/api_reference/query/query_transform.html) | Generates a hypothetical answer, embeds that, and searches with it | Extra LLM call; often improves conceptual QA |
| [Decomposition](https://docs.llamaindex.ai/en/v0.10.18/api_reference/query/query_transform.html) | Splits complex questions into sub-queries | Multiple retrieval passes |
| [Step-back prompting](https://deepmind.google/research/publications/50274/) | Retrieves or reasons from broader background before the specific answer | Extra reasoning/retrieval/generation work |

### Is it worth it? When?

Every transformation adds latency, money, or both. I feel that this stage only works if the product can afford higher turnaround time to reply to a user and this stage improves the quality of retrieval.

If the product has an user asking a support chatbot a simple question, adding an LLM call before retrieval may make the answer feel unnecessarily slow. If the user is doing deep research, legal analysis, clinical summarization, or internal knowledge exploration, an extra second may be acceptable if retrieval improves meaningfully.

This is also where evaluation matters. Do not add query rewriting, multi-query, HyDE, or decomposition because a blog post said it improves RAG. Add it when your eval set shows that raw user queries are the bottleneck.

---

## Stage 5: Retrieval — Reranking The Candidates

We have already talked about dense retrieval, sparse retrieval, and hybrid retrieval in the embeddings section above. So I will not repeat that here.

This stage is about what happens after the first retrieval pass.

The first retriever is usually optimized for speed and recall. It searches a large corpus quickly and tries to bring back a broad set of potentially useful chunks. That is useful, but it does not mean the best chunk is ranked first. That is where reranking helps.

### What reranking does

A reranker takes the user's query and a list of candidate chunks, then scores each chunk for relevance.

The important difference is that the reranker looks at the query and chunk together. A normal embedding search compares two vectors that were created independently. A cross-encoder reranker usually reads the query and candidate text in the same model pass, so it can judge the match more directly.

For example, the first-stage retriever may return 50 chunks that are broadly related to refunds. Some mention cancellation. Some mention failed payments. Some mention refund timelines. Some contain the exact eligibility rule the user needs.

The reranker's job is to reorder those 50 chunks so that the eligibility rule rises to the top.

Typical flow:

1. Use a ANN or hybrid retrieval to retrieve top-30 or top-50 candidates quickly
2. Rerank those top 30 or 50 candidates with a reranker
3. Then send the top-3 or top-5 reranked chunks to the generator

This gives you broad recall first, then precision.

![Two-stage retrieval flow: fast ANN or hybrid search returns top-50 candidates, a reranker selects final context, and the generator cites grounded answers.](/blog/images/rag-explained-for-engineers/04-two-stage-retrieval.png)

### Why reranking improves answers

Generation quality depends heavily on what makes it into the final context window.

If the correct chunk is ranked eighth and you only pass five chunks to the LLM, the model never sees the answer. It may still generate something fluent, but it is now answering from weaker evidence.

Reranking is useful when your first-stage retriever has decent recall but poor ordering. This is common because the first retriever is usually trying to be fast across a large index. It is not doing the deepest relevance judgment.

The reranker can catch subtler matches:

- the query asks about eligibility, but the candidate chunk talks about qualifying conditions
- two chunks mention the same policy, but only one contains the actual exception
- many chunks are semantically related, but only one answers the user's specific question
- hybrid search retrieves both dense and sparse matches, but the merged order is noisy

In these cases, reranking can make the final context much cleaner.

This is especially useful for technical docs, policy documents, clinical content, legal text, financial content, and internal knowledge bases where many chunks look similar but only one or two are actually useful.

### The trade-off

A cross-encoder reranker is usually slower than vector search because it evaluates the query against each candidate chunk. If you rerank 50 chunks, that means 50 query-document relevance judgments. Depending on the model and infrastructure, this can add noticeable latency.

The cost also grows with the number of candidates you rerank. Reranking top-10 is cheaper than reranking top-100, but top-10 may miss useful candidates. This is the same recall-latency trade-off again, just at a different stage of the pipeline.

---

## Stage 6: Generation — Where RAG Quietly Fails

Retrieval gets evidence into the prompt. Generation turns that evidence into user-facing claims. This final last part is what all the previous stages of this pipeline worked towards.

The retriever may find the right chunks. The reranker may put them near the top. The prompt may contain enough information to answer. And the model can still produce an answer that is too broad, too confident, missing a caveat, or not actually supported by the context. The job at this stage is to make the model use the retrieved context faithfully.

### Context ordering matters

The first question is simple, did the model see the best evidence in a place where it can use it?

Even though LLMs are constantly improving, they are still vulnerable to "lost in the middle". They tend to use information near the beginning and end of the context window more reliably than information buried in the middle. If you retrieve ten chunks and put the most relevant one at position seven, you are making the model's job harder for no reason.

So context assembly matters. Put the most relevant chunks first. Keep related chunks together. Do not mix unrelated evidence just because it fit under the token limit. If a parent-document section is needed to understand a chunk, include the surrounding section rather than forcing the model to infer missing context.

This is a small implementation detail with real impact. Bad context ordering can make good retrieval look worse than it is.

### Grounding instructions are cheap and useful

The second question is whether the model is constrained to the evidence.

Do not assume the model will naturally stay inside the retrieved context. Tell it to. Use explicit grounding instructions:

```json
{
	"prompt":"Answer only from the provided context.\
	If the context does not support an answer, say:\
	'I don’t have enough information to answer that.'\
	Do not use information from training data."
}
```

This is one of the cheapest faithfulness improvements available. It costs no extra retrieval step and no new infrastructure.

The important part is abstention behavior. A RAG system should be allowed to say "I don't know" when the retrieved context is insufficient. If every query must produce a confident answer, the system will eventually invent one.

This matters most in domains where partial correctness is dangerous: medical, legal, finance, compliance, HR policy, safety workflows, and customer support answers that create obligations.

### Citations and faithfulness checks

Faithfulness and citations checks are how you keep tabs on generation quality after launch.

Citations shows which chunk, section, page, or document the model used for a claim. It makes answers auditable and without that, you cannot easily tell whether retrieval, reranking, prompting, or source quality caused the failure.

Good citations should point as close as possible to the evidence: source chunk, section, page, paragraph, or table. Citations that only point to a giant PDF or a generic document are better than nothing, but they are much less useful.

Faithfulness checks go one step further. They ask a second model call, rule-based checker, evaluator, or human review process:

> Is this answer actually supported by the retrieved context?

You do not always need to run this synchronously in the user path. In many products, it is better to sample production answers asynchronously: 1–5% of all answers, low-confidence answers, answers with no citations, or answers from high-risk workflows.

If the product is high-stakes, you may run faithfulness checks before showing the answer. In lower-risk systems, asynchronous monitoring may be enough. Either way, treat groundedness as a production metric. If it drops, investigate it like you would investigate latency spikes or error-rate regressions.

---

## Stage 7: Evaluation — The Thing You Will Skip and Regret

Evaluation is not really an isolated stage honestly. It is attached to every stage in a way which helps us debug and decide about how to best build or tweak the RAG pipeline.

Till this stage, you had a lot of knobs to turn. You could change chunk size, switch embeddings, add hybrid search, tune the vector index, add reranking, rewrite queries, or change the generation prompt. Without evaluation, all of those changes remain unverified. The system may sound better on three hand-picked examples and still get worse for the actual query distribution.

![RAG evaluation loop: golden eval set, retrieval metrics, generation checks, and CI gates make the system measurable.](/blog/images/rag-explained-for-engineers/05-eval-control-system.png)

### Why similarity scores are not enough

A chunk can be close in embedding space and still be useless for answering the question. It can mention the same topic, use similar words, or live in the right part of the corpus, while still not containing the actual answer.

This is why you need ground truth. For each eval example, you should know what the user asked, what a good answer looks like, and which source chunk or document supports it.

### Retrieval metrics

Retrieval metrics answer this question:
*Did the retrieval system bring back the evidence needed to answer?*

Table of commonly used metrics.

| Metric | What it tells you |
|---|---|
| Recall@k | Did the correct chunk appear somewhere in the top-k? |
| NDCG | Was the correct chunk ranked near the top? |
| MRR | How high was the first correct result? |

Start with Recall@k to see if the correct chunk is retrieved or not. Then look at ranking metrics like NDCG or MRR. These matter once the correct chunk is being retrieved somewhere but not consistently appearing near the top.

That distinction tells you what to fix. If Recall@k is bad, look at chunking, embeddings, metadata filters, hybrid search, or query transformation. If Recall@k is good but ranking is weak, look at reranking, top-k, or candidate ordering.

![Debug retrieval before generation: first check whether the right evidence reached context, then check answer faithfulness.](/blog/images/rag-explained-for-engineers/09-retrieval-vs-generation-debugging-xiaohei.png)

### Generation metrics

Generation metrics answer a different question:
*Given the retrieved context, did the model produce a useful and faithful answer?*

RAGAS-style metrics are useful here:

| Metric | What it checks |
|---|---|
| Faithfulness | Does the answer stay grounded in retrieved context? |
| Answer Relevance | Does the answer address the question? |
| Context Precision | Were retrieved chunks actually useful? |
| Context Recall | Did retrieved context contain what was needed? |

These metrics are not always perfect. Use them mainly to catch regressions and compare changes.

### Build a golden eval set

A golden eval set is a small, trusted set of examples that represents how the system should behave.

You do not need thousands of examples to start. Start with 50–200 representative question-answer pairs with correct source chunks labeled.

As a rule of thumb, use:

- real user queries if available
- expected query patterns if not
- edge cases from domain experts
- known failure modes

Each example should answer three things:

- what did the user ask?
- what answer should the system give?
- which source chunk or document supports that answer?

Then make it part of CI or your deployment process. A regression in Recall@k should block deployment just like a failing unit test.

Although this is time consuming, it pays for itself the first time it catches a retrieval regression before users do.

### Offline vs online evaluation

I think of these two as pre and post production signals. Offline eval tells you whether known cases work, typically checked before shipping. Online eval tells you whether real users are getting value. Online eval is where you discover new failure modes, confusing queries, missing documents, and user expectations your golden set did not cover.

Useful signals:

- thumbs up/down
- answer edits
- repeated queries
- escalation to human support
- citation clicks

When available, online feedback closes the loop between lab quality and production quality.

### How I approach evaluation

Here is the practical sequence I typically follow.

First, build a small golden set before optimizing the pipeline. Even 50 examples are enough to stop obvious regressions.

Second, separate retrieval eval from generation eval. If the right context is missing, fix retrieval. If the right context is present and the answer is still bad, fix generation.

Third, track Recall@k first. If the right evidence does not appear in the candidate set, everything after retrieval is downstream damage control.

Fourth, add ranking metrics once recall is decent. If the correct chunk appears in top-50 but not top-5, reranking and ranking changes are worth testing.

Fifth, add faithfulness and answer-quality checks for the generated response. This catches cases where retrieval worked but the model overreached.

Finally, keep adding production failures back into the eval set. Every embarrassing failure should become a test case so you do not rediscover it later.

---

## The “Don’t Embarrass Yourself in Production” RAG Stack

These are guidelines to think about and build on, to minimize the risk of something going wrong in production:

| Stage | Default choice |
|---|---|
| Chunking | Recursive splitting, 512 tokens, 128 overlap |
| Embeddings | `text-embedding-3-large` or `bge-large-en-v1.5` |
| Vector DB | `pgvector` under 10M vectors; Qdrant beyond that or for richer retrieval |
| Metadata | Store source, permissions, document version, section, timestamp, and chunk strategy |
| Query transformation | Skip in v1 |
| Retrieval | Hybrid search: dense + BM25, merged with [RRF](https://www.mongodb.com/resources/basics/reciprocal-rank-fusion#retrieval-augmented-generation) |
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

If you cannot answer these, your system may still be a demo and not production ready.
