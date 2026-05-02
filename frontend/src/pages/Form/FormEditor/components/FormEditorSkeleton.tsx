export default function FormEditorSkeleton() {
  return (
    <div className="h-full w-full bg-blue-50 flex flex-col overflow-hidden animate-pulse">
      
      {/* ツールバーのスケルトン */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gray-200 rounded-full" />
          <div className="w-48 h-7 bg-gray-200 rounded-md" />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-5 bg-gray-200 rounded-md hidden md:block" />
          <div className="w-px h-6 bg-gray-200 hidden md:block" />
          <div className="w-9 h-9 bg-gray-200 rounded-full" />
          <div className="w-24 h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* メインエリアのスケルトン */}
      <div className="flex-1 overflow-y-auto py-10 flex flex-col items-center pb-32">
        <div className="w-full max-w-3xl px-4 space-y-6">
          
          {/* TitleBox のスケルトン */}
          <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-blue-200 p-6">
            <div className="w-2/3 h-10 bg-gray-200 rounded-md mb-6" />
            <div className="w-full h-24 bg-gray-100 rounded-md" />
          </div>

          {/* QuestionBox のスケルトン 1 */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="w-3/4 h-12 bg-gray-200 rounded-md" />
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-1/3 h-5 bg-gray-100 rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-1/4 h-5 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 h-12 bg-gray-100 rounded-md" />
          </div>

          {/* QuestionBox のスケルトン 2 */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="w-1/2 h-12 bg-gray-200 rounded-md" />
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                  <div className="w-2/5 h-5 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 h-12 bg-gray-100 rounded-md" />
          </div>

        </div>
      </div>
    </div>
  );
}
