const studentService = require('./student.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentService.createStudent(req.tenantId, req.body, req.user.id);
  return ApiResponse.created(res, student, 'Student created successfully');
});

const listStudents = asyncHandler(async (req, res) => {
  const result = await studentService.listStudents(req.tenantId, req.query, req.user.role, req.user.id);
  return ApiResponse.paginated(res, result.students, result.pagination);
});

const listDeletedStudents = asyncHandler(async (req, res) => {
  const result = await studentService.listDeletedStudents(req.tenantId, req.query);
  return ApiResponse.paginated(res, result.students, result.pagination);
});

const getStudent = asyncHandler(async (req, res) => {
  const student = await studentService.getStudent(req.params.id, req.tenantId, req.user.role, req.user.id);
  return ApiResponse.success(res, student);
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.tenantId, req.body, req.user.role, req.user.id);
  return ApiResponse.success(res, student, 'Student updated');
});

const deleteStudent = asyncHandler(async (req, res) => {
  await studentService.deleteStudent(req.params.id, req.tenantId, req.user.role, req.user.id);
  return ApiResponse.success(res, null, 'Student deleted');
});

const transferStudent = asyncHandler(async (req, res) => {
  const student = await studentService.transferStudent(req.params.id, req.tenantId, req.body.ownerId);
  return ApiResponse.success(res, student, 'Student ownership transferred');
});

const restoreStudent = asyncHandler(async (req, res) => {
  const student = await studentService.restoreStudent(req.params.id, req.tenantId);
  return ApiResponse.success(res, student, 'Student restored');
});

const permanentlyDeleteStudent = asyncHandler(async (req, res) => {
  await studentService.permanentlyDeleteStudent(req.params.id, req.tenantId);
  return ApiResponse.success(res, null, 'Student permanently deleted');
});

module.exports = {
  createStudent, listStudents, listDeletedStudents, getStudent, updateStudent,
  deleteStudent, restoreStudent, permanentlyDeleteStudent, transferStudent,
};
