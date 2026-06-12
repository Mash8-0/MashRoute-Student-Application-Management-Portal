const studentService = require('./student.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentService.createStudent(req.tenantId, req.body);
  return ApiResponse.created(res, student, 'Student created successfully');
});

const listStudents = asyncHandler(async (req, res) => {
  const result = await studentService.listStudents(req.tenantId, req.query);
  return ApiResponse.paginated(res, result.students, result.pagination);
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await studentService.getStudent(req.params.id, req.tenantId);
  return ApiResponse.success(res, student);
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.tenantId, req.body);
  return ApiResponse.success(res, student, 'Student updated');
});

const deleteStudent = asyncHandler(async (req, res) => {
  await studentService.deleteStudent(req.params.id, req.tenantId);
  return ApiResponse.success(res, null, 'Student deleted');
});

module.exports = { createStudent, listStudents, getStudent, updateStudent, deleteStudent };
