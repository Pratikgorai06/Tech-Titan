# Security Specification for Campus Mate ERP

## 1. Data Invariants
- A **User** document must be owned by the user (UID match). Students cannot change their own GPA or Role.
- An **Event** can only be created/modified by an admin. Students can only update the `rsvps` array.
- A **Complaint** must be authored by a student. Once created, the description and studentId are immutable. Only admins can change the status.
- A **Fee** record can only be modified by the student to change the status to 'paid'. Amount and dueDate are immutable.

## 2. The "Dirty Dozen" (Attack Payloads)
1. **Identity Theft**: User A tries to update User B's profile.
2. **Role Escalation**: Student tries to set `role: 'admin'` on their own profile.
3. **Academic Fraud**: Student tries to update their own `gpa`.
4. **Shadow Event**: Student tries to create a new campus event.
5. **RSVP Poisoning**: Student tries to clear the entire RSVP list of an event.
6. **Complaint Forgery**: Student A tries to file a complaint as Student B.
7. **Complaint Mutation**: Student tries to change the text of a complaint after it's been "resolved".
8. **Fee Erasure**: Student tries to delete a pending fee record.
9. **Discount Attack**: Student tries to update a Fee record's `amount` to $0.
10. **Orphaned Write**: Creating a complaint for a non-existent student ID.
11. **Large Document Attack**: Sending a 1MB string into the `subject` field.
12. **Status Spoofing**: Student tries to mark a complaint as 'resolved' without admin action.

## 3. Security Assertions
- `auth != null` for all write operations.
- `resource.data.userId == request.auth.uid` for ownership-based access.
- `affectedKeys().hasOnly(...)` to restrict field-level updates.
- `isValidId()` to prevent path poisoning.
