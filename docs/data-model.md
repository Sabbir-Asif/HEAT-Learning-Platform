# Data model

Generated from `packages/db/prisma/schema` by `pnpm --filter @heat/db er-diagram`. Do not edit it by hand: a test fails when it is stale.

```mermaid
erDiagram
  Course {
    String id PK
    String slug
    String title
    String description
    CourseStatus status
    DateTime lockedAt
    DateTime publishedAt
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  CourseRevision {
    String id PK
    String courseId FK
    Int number
    DateTime publishedAt
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Module {
    String id PK
    String revisionId FK
    Int order
    String title
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  LessonSection {
    String id PK
    String moduleId FK
    Int order
    Json body
    Int schemaVersion
    String[] objectives
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  VideoAsset {
    String id PK
    String assetKey
    VideoAssetStatus status
    Int referenceCount
    Int durationSeconds
    DateTime createdAt
    DateTime updatedAt
  }
  Video {
    String id PK
    String moduleId FK
    Int order
    String title
    String assetId FK
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  VideoRendition {
    String id PK
    String assetId FK
    String label
    Int bitrateKbps
    DateTime createdAt
    DateTime updatedAt
  }
  VideoCaption {
    String id PK
    String assetId FK
    String language
    String captionKey
    DateTime createdAt
    DateTime updatedAt
  }
  Tag {
    String id PK
    String slug
    String name
    Boolean isSystem
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  CourseTag {
    String courseId PK, FK
    String tagId PK, FK
    Int displayOrder
    DateTime createdAt
  }
  ModuleTag {
    String moduleId PK, FK
    String tagId PK, FK
    Int displayOrder
    DateTime createdAt
  }
  SiteSetting {
    String id PK
    String key
    Json value
    DateTime createdAt
    DateTime updatedAt
  }
  University {
    String id PK
    String name
    DateTime archivedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Faculty {
    String id PK
    String name
    DateTime archivedAt
    DateTime createdAt
    DateTime updatedAt
  }
  UniversityFaculty {
    String universityId PK, FK
    String facultyId PK, FK
    DateTime createdAt
  }
  Department {
    String id PK
    String name
    String universityId FK
    String facultyId FK
    DateTime archivedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Enrollment {
    String id PK
    String userId FK
    String courseId FK
    String courseRevisionId FK
    EnrollmentStatus status
    EnrollmentStatus statusBeforeRemoval
    DateTime requestedAt
    DateTime verifiedAt
    DateTime approvedAt
    DateTime rejectedAt
    DateTime removedAt
    DateTime completedAt
    DateTime expiredAt
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  EnrollmentDecision {
    String id PK
    String enrollmentId FK
    String adminId FK
    DecisionAction action
    String reason
    DateTime decidedAt
    DateTime createdAt
  }
  User {
    String id PK
    String email
    String passwordHash
    UserRole role
    Realm realm
    DateTime emailVerifiedAt
    Boolean mustChangePassword
    DateTime deactivatedAt
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  StudentProfile {
    String id PK
    String userId FK
    String name
    String departmentId FK
    String session
    DateTime deletedAt
    DateTime createdAt
    DateTime updatedAt
  }
  Session {
    String id PK
    String userId FK
    String refreshTokenHash
    String familyId
    DateTime expiresAt
    DateTime rotatedAt
    DateTime revokedAt
    String userAgent
    String ipAddress
    DateTime createdAt
    DateTime updatedAt
  }
  AuthToken {
    String id PK
    String userId FK
    AuthTokenPurpose purpose
    String tokenHash
    DateTime expiresAt
    DateTime usedAt
    DateTime createdAt
    DateTime updatedAt
  }
  AdminCredential {
    String id PK
    String userId FK
    Bytes totpSecretEncrypted
    DateTime enabledAt
    DateTime createdAt
    DateTime updatedAt
  }
  RecoveryCode {
    String id PK
    String userId FK
    String codeHash
    DateTime usedAt
    DateTime createdAt
    DateTime updatedAt
  }
  ProfileChangeRequest {
    String id PK
    String userId FK
    String requestedName
    String requestedDepartmentId FK
    String requestedSession
    ProfileChangeStatus status
    String decidedById FK
    DateTime decidedAt
    String reason
    DateTime createdAt
    DateTime updatedAt
  }
  Course ||--o{ CourseRevision : course
  CourseRevision ||--o{ Module : revision
  Module ||--o{ LessonSection : module
  Module ||--o{ Video : module
  VideoAsset ||--o{ Video : asset
  VideoAsset ||--o{ VideoRendition : asset
  VideoAsset ||--o{ VideoCaption : asset
  Course ||--o{ CourseTag : course
  Tag ||--o{ CourseTag : tag
  Module ||--o{ ModuleTag : module
  Tag ||--o{ ModuleTag : tag
  University ||--o{ UniversityFaculty : university
  Faculty ||--o{ UniversityFaculty : faculty
  UniversityFaculty ||--o{ Department : universityFaculty
  User ||--o{ Enrollment : user
  Course ||--o{ Enrollment : course
  CourseRevision |o--o{ Enrollment : courseRevision
  Enrollment ||--o{ EnrollmentDecision : enrollment
  User ||--o{ EnrollmentDecision : admin
  User ||--o| StudentProfile : user
  Department ||--o{ StudentProfile : department
  User ||--o{ Session : user
  User ||--o{ AuthToken : user
  User ||--o| AdminCredential : user
  User ||--o{ RecoveryCode : user
  User ||--o{ ProfileChangeRequest : user
  User |o--o{ ProfileChangeRequest : decidedBy
  Department |o--o{ ProfileChangeRequest : requestedDepartment
```
