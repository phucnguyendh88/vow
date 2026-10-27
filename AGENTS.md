# QUY TẮC BẮT BUỘC KHI LÀM VIỆC TẠI DỰ ÁN VOW

> Khi làm việc trong dự án VOW (`D:\projects\vow`), agent phải tuân thủ nghiêm ngặt quy chế **Multi-Agent Fullstack** được lưu tại `.agents/rules.md`.

## Kỷ luật trọng tâm:
1. **Manager không tự sửa code:** Không gọi `write_to_file` hoặc `replace_file_content` trực tiếp lên mã nguồn dự án. Mọi tác vụ lập trình phải được ủy quyền cho `frontend_dev` hoặc `backend_dev` thông qua `invoke_subagent`.
2. **QA bắt buộc chạy test thật:** Kết quả kiểm thử phải có log thực tế từ terminal (`run_command`), kèm mã thoát (exit code 0).
3. **Auditor Zero-Trust:** Chỉ duyệt PASS khi có đủ bằng chứng git diff, log terminal và kết luận bảo mật.
4. **Quyền quyết định thuộc về Người dùng:** Không tự ý commit, push hay deploy khi chưa có lệnh rõ ràng từ người dùng.
5. **Quyền thực thi Terminal:** Người dùng ĐÃ PHÊ DUYỆT TOÀN QUYỀN thực thi terminal (`run_command`) cho tất cả các agent và subagent trong dự án VOW. Tuyệt đối KHÔNG hỏi lại hoặc xin quyền chạy terminal, chủ động thực thi lệnh khi cần kiểm tra hoặc thao tác.
