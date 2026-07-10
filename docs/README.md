# ProNeighbor Documentation

> Last Updated: June 29, 2026

Welcome to the ProNeighbor documentation hub. This directory contains comprehensive documentation covering all aspects of the platform, from architecture to end-user guides.

---

## 📚 Documentation Index

### For Developers & Architects

| Document | Description | Version |
|----------|-------------|---------|
| [Architecture](./architecture.md) | System architecture, design decisions, trade-offs, and technical overview | 2.1 |
| [Order Flow](./order-flow.md) | Complete booking lifecycle, state machine, escrow handling, and edge cases | 2.1 |
| [AGoT Playbook](./AGoT-playbook.md) | Adaptive Graph of Thoughts reasoning framework for codebase analysis | 1.1 |

### For Product & Strategy

| Document | Description | Version |
|----------|-------------|---------|
| [Options Engine](./strategies/options-engine.md) | Subscription & monetization strategy, pricing, renewal lifecycle | 1.1 |
| [Functional Specification](./Functional-Specification.md) | Complete feature specification, user stories, data models | 1.1 |

### For End Users

| Document | Description | Version |
|----------|-------------|---------|
| [User Guide](./USER-GUIDE.md) | Comprehensive guide for residents, professionals, and admins | 1.0 |

---

## 🗂️ Documentation Structure

```
docs/
├── README.md                      # This file - documentation index
├── architecture.md                # System architecture & design decisions
├── order-flow.md                  # Booking lifecycle & state machine
├── AGoT-playbook.md               # Reasoning framework for development
├── Functional-Specification.md    # Feature specification & data models
├── USER-GUIDE.md                  # End-user documentation
└── strategies/
    └── options-engine.md          # Subscription & monetization strategy
```

---

## 📖 Quick Navigation

### I want to understand...

| Question | Document |
|----------|----------|
| How is the system built? | [Architecture](./architecture.md) |
| How do bookings work? | [Order Flow](./order-flow.md) |
| What features are available? | [Functional Specification](./Functional-Specification.md) |
| How does monetization work? | [Options Engine](./strategies/options-engine.md) |
| How do I use the platform? | [User Guide](./USER-GUIDE.md) |
| How should I make decisions? | [AGoT Playbook](./AGoT-playbook.md) |

### I need to...

| Task | Document |
|------|----------|
| Onboard as a developer | [Architecture](./architecture.md) → [AGoT Playbook](./AGoT-playbook.md) |
| Implement a new feature | [AGoT Playbook](./AGoT-playbook.md) → [Functional Specification](./Functional-Specification.md) |
| Fix a booking bug | [Order Flow](./order-flow.md) |
| Change subscription pricing | [Options Engine](./strategies/options-engine.md) |
| Help a user | [User Guide](./USER-GUIDE.md) |

---

## 🔗 Related Documentation

### Root-Level Documentation

| Document | Description |
|----------|-------------|
| [README.md](../README.md) | Project overview and getting started |
| [AGENTS.md](../AGENTS.md) | AI agent guidelines and coding conventions |
| [CLAUDE.md](../CLAUDE.md) | Claude Code specific guidance |

### Planning & Audit

| Document | Description |
|----------|-------------|
| [.planning/](../.planning/) | Project planning and roadmap |
| [AUDIT_REPORT.md](../AUDIT_REPORT.md) | Comprehensive code audit findings |

### Testing

| Document | Description |
|----------|-------------|
| [e2e/README.md](../e2e/README.md) | E2E testing guide |
| [src/__tests__/README.md](../src/__tests__/README.md) | Unit testing guide |

---

## 📝 Documentation Standards

### Versioning

All documentation follows semantic versioning:
- **Major version** (X.0): Breaking changes or major restructures
- **Minor version** (X.Y): Significant additions or updates
- **Patch updates**: Corrections and clarifications within the same version

### Update Process

1. Make changes to the relevant document
2. Update the version number in the document header
3. Update the "Last Updated" date
4. Ensure cross-references are accurate
5. Test any code examples for correctness

### Cross-References

Documents link to each other using relative paths:
```markdown
See [Architecture](./architecture.md) for system overview.
```

---

## 🤝 Contributing to Documentation

When adding or updating documentation:

1. **Keep it accurate**: Verify against the current codebase
2. **Use examples**: Include code snippets and diagrams where helpful
3. **Link related docs**: Add cross-references to relevant documents
4. **Update the index**: If adding a new document, update this README
5. **Follow conventions**: Use consistent formatting and terminology

---

*ProNeighbor - Connecting communities with trusted local professionals*
