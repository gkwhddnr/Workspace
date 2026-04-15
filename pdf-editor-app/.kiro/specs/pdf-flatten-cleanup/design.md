# Design Document: PDF Flatten Cleanup

## Overview

PDF Flatten Cleanup 기능은 `data/originals` 폴더에 저장된 PDF 파일들의 어노테이션(필기, 도형, 텍스트 등)을 PDF 본문에 영구적으로 병합(flatten)하여 편집 불가능한 최종본을 생성하고, 원본 파일 및 관련 DB 데이터를 삭제하는 기능이다.

이 기능은 앱 시작 시간 저하 문제를 해결하기 위해 설계되었으며, 사용자는 프론트엔드 UI에서 파일을 선택하고 처리 결과를 확인할 수 있다.

### Key Design Goals

1. **안전한 데이터 처리**: Flatten 처리 실패 시 원본 파일과 DB 데이터를 보존
2. **사용자 경험**: 직관적인 파일 선택 UI와 명확한 처리 결과 피드백
3. **확장성**: 향후 배치 처리 또는 스케줄링 기능 추가 가능한 구조
4. **성능**: 대용량 파일 처리 시에도 안정적인 메모리 관리

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌────────────────┐         ┌──────────────────────┐       │
│  │ FlattenModal   │────────▶│ FlattenApiService    │       │
│  │ (UI Component) │         │ (HTTP Client)        │       │
│  └────────────────┘         └──────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/JSON
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Spring Boot)                      │
│  ┌────────────────┐         ┌──────────────────────┐       │
│  │ FlattenController│───────▶│ FlattenService       │       │
│  │ (REST API)      │         │ (Business Logic)     │       │
│  └────────────────┘         └──────────────────────┘       │
│                                    │                         │
│                                    ├──▶ PDFBox Library       │
│                                    ├──▶ FileSystem (I/O)     │
│                                    └──▶ H2 Database          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **FlattenModal (Frontend)**
   - 파일 목록 표시 및 선택 UI
   - 처리 진행 상태 표시
   - 결과 피드백 표시

2. **FlattenApiService (Frontend)**
   - HTTP 요청 추상화
   - 에러 핸들링 및 재시도 로직

3. **FlattenController (Backend)**
   - REST API 엔드포인트 제공
   - 요청 검증 및 응답 포맷팅

4. **FlattenService (Backend)**
   - PDF Flatten 처리 (PDFBox 사용)
   - 파일 시스템 작업 (저장, 삭제)
   - DB 작업 (PdfWorkspace, WorkHistory 삭제)

---

## Components and Interfaces

### Backend Components

#### FlattenController

```kotlin
@RestController
@RequestMapping("/api/pdf/flatten")
class FlattenController(
    private val flattenService: FlattenService
) {
    @GetMapping("/files")
    fun listOriginalsFiles(): ResponseEntity<List<FileInfo>>
    
    @PostMapping("/process")
    fun processFlatten(@RequestBody request: FlattenRequest): ResponseEntity<FlattenResponse>
}

data class FileInfo(
    val filename: String,
    val sizeBytes: Long
)

data class FlattenRequest(
    val filenames: List<String>
)

data class FlattenResponse(
    val successCount: Int,
    val results: List<FlattenResult>
)

data class FlattenResult(
    val filename: String,
    val success: Boolean,
    val outputPath: String?,
    val errorMessage: String?
)
```

#### FlattenService

```kotlin
@Service
class FlattenService(
    private val pdfWorkspaceRepository: PdfWorkspaceRepository,
    private val workHistoryRepository: WorkHistoryRepository
) {
    fun listOriginalsFiles(): List<FileInfo>
    
    fun processFlatten(filenames: List<String>): FlattenResponse
    
    private fun flattenSinglePdf(filename: String): FlattenResult
    
    private fun deleteOriginalAndDbData(filename: String)
    
    private fun generateUniqueDownloadPath(filename: String): Path
}
```

**Key Methods:**

- `listOriginalsFiles()`: `data/originals` 폴더의 PDF 파일 목록 반환
- `processFlatten()`: 선택된 파일들을 순회하며 flatten 처리
- `flattenSinglePdf()`: 단일 PDF 파일의 flatten 처리 (PDFBox 사용)
- `deleteOriginalAndDbData()`: 원본 파일 및 DB 레코드 삭제
- `generateUniqueDownloadPath()`: Downloads 폴더에 중복되지 않는 파일명 생성

### Frontend Components

#### FlattenModal

```typescript
interface FlattenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FileItem {
    filename: string;
    sizeBytes: number;
    selected: boolean;
}

interface FlattenModalState {
    files: FileItem[];
    loading: boolean;
    processing: boolean;
    result: FlattenResponse | null;
}

export function FlattenModal({ isOpen, onClose }: FlattenModalProps): JSX.Element
```

**Key Features:**

- 파일 목록 로드 및 체크박스 선택
- 전체 선택/해제 기능
- 처리 진행 상태 표시 (로딩 스피너)
- 처리 결과 표시 (성공/실패 파일 목록)

#### FlattenApiService

```typescript
export class FlattenApiService {
    async listFiles(): Promise<FileInfo[]>
    
    async processFlatten(filenames: string[]): Promise<FlattenResponse>
}

export const flattenApiService = new FlattenApiService();
```

---

## Data Models

### Database Entities

기존 엔티티를 사용하며, 삭제 대상:

1. **PdfWorkspace**
   - `filename` 필드로 매칭하여 삭제
   - 관련 필드: `projectData`, `hasOriginalPdf`

2. **WorkHistory**
   - `originalFileName` 필드로 매칭하여 삭제
   - 저장 이력 레코드 전체 삭제

### File System Structure

```
project-root/
├── data/
│   └── originals/          # Flatten 대상 원본 PDF 파일
│       ├── file1.pdf.pdf
│       └── file2.pdf.pdf
└── ~/Downloads/            # Flatten 처리 결과 저장 위치
    ├── file1.pdf
    └── file2.pdf
```

### API Data Transfer Objects

**Request:**
```json
{
  "filenames": ["file1.pdf.pdf", "file2.pdf.pdf"]
}
```

**Response:**
```json
{
  "successCount": 2,
  "results": [
    {
      "filename": "file1.pdf.pdf",
      "success": true,
      "outputPath": "/Users/username/Downloads/file1.pdf",
      "errorMessage": null
    },
    {
      "filename": "file2.pdf.pdf",
      "success": false,
      "outputPath": null,
      "errorMessage": "Failed to flatten: Invalid PDF structure"
    }
  ]
}
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File list completeness and structure

*For any* set of PDF files in `data/originals`, when the file list API is called, the response SHALL contain all files with both `filename` and `sizeBytes` fields populated correctly.

**Validates: Requirements 1.1, 1.4**

### Property 2: Annotation removal after flatten

*For any* PDF file with annotations, after flatten processing, the output PDF SHALL have all annotations removed and their visual content merged into the page content stream.

**Validates: Requirements 2.1**

### Property 3: Output file location and naming

*For any* successfully flattened PDF, the output file SHALL be saved in the user's Downloads folder with the same filename as the original (excluding the `.pdf.pdf` suffix).

**Validates: Requirements 2.2, 2.3**

### Property 4: Filename collision handling

*For any* flatten operation where the target filename already exists in Downloads, the output filename SHALL have a suffix `_(n)` appended where n is the smallest positive integer that makes the filename unique.

**Validates: Requirements 2.4**

### Property 5: Response format consistency

*For any* flatten operation on a set of files, the response SHALL contain `successCount` equal to the number of successfully processed files and a `results` array with one entry per input file.

**Validates: Requirements 2.5**

### Property 6: Partial failure resilience

*For any* flatten operation on multiple files where at least one file fails, the service SHALL continue processing remaining files and include error messages for failed files in the response.

**Validates: Requirements 2.6**

### Property 7: Original file cleanup after success

*For any* successfully flattened PDF, the original file in `data/originals` SHALL be deleted from the filesystem.

**Validates: Requirements 3.1**

### Property 8: Database cleanup after success

*For any* successfully flattened PDF, both the PdfWorkspace and WorkHistory records matching the filename SHALL be deleted from the database.

**Validates: Requirements 3.2, 3.3**

### Property 9: Button state based on selection

*For any* file selection state in FlattenModal, the "Flatten 실행" button SHALL be disabled if and only if no files are selected.

**Validates: Requirements 4.3**

### Property 10: Result display completeness

*For any* flatten operation result, the FlattenModal SHALL display the count of successful files and list all failed files with their error messages.

**Validates: Requirements 4.5**

### Property 11: File size display formatting

*For any* file in the file list, the displayed size SHALL be formatted in KB units with appropriate precision.

**Validates: Requirements 6.4**

---

## Error Handling

### Error Categories

1. **File System Errors**
   - Missing `data/originals` folder → Return empty list
   - File read/write permission errors → Include in result with error message
   - Disk space exhaustion → Fail gracefully with error message

2. **PDF Processing Errors**
   - Corrupted PDF structure → Skip file, continue with others
   - PDFBox library exceptions → Catch and log, include in error response
   - Memory exhaustion on large files → Fail with appropriate error message

3. **Database Errors**
   - Connection failures → Log error, do not delete files
   - Record not found → Continue without error (idempotent operation)
   - Transaction failures → Rollback, preserve original state

4. **API Errors**
   - Invalid request format → Return 400 Bad Request
   - Empty filename list → Return 400 Bad Request
   - Server errors → Return 500 Internal Server Error with details

### Error Handling Strategy

1. **Transactional Safety**
   - Flatten PDF first, verify success before deleting original
   - Delete file before deleting DB records
   - If file deletion fails, do not delete DB records
   - Log all errors for debugging

2. **User Feedback**
   - Clear error messages in API responses
   - Distinguish between partial and total failures
   - Provide actionable error information (e.g., "File corrupted", "Insufficient disk space")

3. **Graceful Degradation**
   - Continue processing remaining files on individual failures
   - Return partial success results
   - Preserve system state on critical errors

### Error Response Format

```json
{
  "successCount": 1,
  "results": [
    {
      "filename": "success.pdf.pdf",
      "success": true,
      "outputPath": "/Users/username/Downloads/success.pdf",
      "errorMessage": null
    },
    {
      "filename": "corrupted.pdf.pdf",
      "success": false,
      "outputPath": null,
      "errorMessage": "Failed to flatten: Invalid PDF structure at page 3"
    }
  ]
}
```

---

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

### Unit Testing Focus

Unit tests should cover:

1. **Edge Cases**
   - Empty `data/originals` folder (Requirement 1.2)
   - Missing `data/originals` folder (Requirement 1.3)
   - File deletion failure scenario (Requirement 3.4)
   - Missing DB records (Requirement 3.5)

2. **UI Component Behavior**
   - FlattenModal renders file list with checkboxes (Requirement 4.1)
   - "전체 선택" and "전체 해제" buttons work correctly (Requirement 4.2)
   - Loading state displays correctly (Requirement 4.4)
   - Modal closes and resets state (Requirement 4.6)
   - Header button renders (Requirement 5.1)
   - Keyboard shortcut opens modal (Requirement 5.2)
   - Button click opens modal (Requirement 5.3)
   - Event blocking while modal is open (Requirement 5.4)
   - Auto-load on modal open (Requirement 6.1)
   - Loading indicator during fetch (Requirement 6.2)
   - Error state with retry button (Requirement 6.3)

3. **Integration Points**
   - API endpoint routing
   - Database transaction boundaries
   - File system operations

### Property-Based Testing Focus

Property tests should verify universal behaviors across randomized inputs:

1. **Backend Properties**
   - Property 1: File list completeness (100+ random file sets)
   - Property 2: Annotation removal (100+ random PDFs with annotations)
   - Property 3: Output location and naming (100+ random filenames)
   - Property 4: Filename collision handling (100+ collision scenarios)
   - Property 5: Response format consistency (100+ random file sets)
   - Property 6: Partial failure resilience (100+ mixed success/failure scenarios)
   - Property 7: Original file cleanup (100+ successful flatten operations)
   - Property 8: Database cleanup (100+ successful flatten operations)

2. **Frontend Properties**
   - Property 9: Button state logic (100+ random selection states)
   - Property 10: Result display (100+ random result sets)
   - Property 11: File size formatting (100+ random file sizes)

### Property-Based Testing Configuration

- **Library**: Kotest Property Testing for Kotlin backend, fast-check for TypeScript frontend
- **Iterations**: Minimum 100 per property test
- **Tag Format**: `@Tag("Feature: pdf-flatten-cleanup, Property {number}: {property_text}")`

### Test Data Generation

1. **PDF Generation**
   - Use PDFBox to generate test PDFs with random annotations
   - Include various annotation types: text, shapes, highlights
   - Generate corrupted PDFs for error testing

2. **File System Mocking**
   - Mock `data/originals` folder with random file sets
   - Mock Downloads folder for output verification
   - Simulate permission errors and disk space issues

3. **Database Mocking**
   - Use H2 in-memory database for tests
   - Pre-populate with random PdfWorkspace and WorkHistory records
   - Test with missing records for idempotency

### Example Property Test (Kotlin + Kotest)

```kotlin
@Test
@Tag("Feature: pdf-flatten-cleanup, Property 1: File list completeness and structure")
fun `property - file list contains all files with required fields`() = runTest {
    checkAll(100, Arb.list(Arb.string(1..50), 0..20)) { filenames ->
        // Arrange: Create random PDF files in originals folder
        val testFolder = Files.createTempDirectory("originals")
        filenames.forEach { name ->
            val file = testFolder.resolve("$name.pdf")
            Files.write(file, ByteArray(1024) { it.toByte() })
        }
        
        // Act: Call list files API
        val result = flattenService.listOriginalsFiles()
        
        // Assert: All files present with required fields
        result.size shouldBe filenames.size
        result.forEach { fileInfo ->
            fileInfo.filename shouldNotBe null
            fileInfo.sizeBytes shouldBeGreaterThan 0
        }
        
        // Cleanup
        testFolder.toFile().deleteRecursively()
    }
}
```

### Example Property Test (TypeScript + fast-check)

```typescript
import fc from 'fast-check';

test('Property 9: Button state based on selection', () => {
  fc.assert(
    fc.property(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
      (selections) => {
        // Arrange: Create file list with random selection states
        const files = selections.map((selected, i) => ({
          filename: `file${i}.pdf`,
          sizeBytes: 1024,
          selected,
        }));
        
        // Act: Render component
        const { getByText } = render(<FlattenModal files={files} />);
        const button = getByText('Flatten 실행');
        
        // Assert: Button disabled iff no files selected
        const anySelected = selections.some(s => s);
        expect(button.disabled).toBe(!anySelected);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Coverage Goals

- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Property Test Iterations**: 100 per property
- **Edge Case Coverage**: 100% of identified edge cases

