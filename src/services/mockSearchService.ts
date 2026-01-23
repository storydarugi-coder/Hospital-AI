/**
 * 목업 검색 서비스 (테스트용)
 * Custom Search API 없이 테스트 가능
 */

export async function searchGoogleBlogsMock(
  query: string,
  num: number = 10
): Promise<any> {
  // 가짜 검색 결과
  const mockResults = [
    {
      title: "당뇨병 예방하는 5가지 생활습관",
      link: "https://blog.naver.com/health123/당뇨병예방",
      snippet: "당뇨병을 예방하려면 규칙적인 운동과 식이조절이 필수입니다. 하루 30분 이상 걷기, 채소 위주 식단, 정기 검진이 중요합니다.",
      displayLink: "blog.naver.com"
    },
    {
      title: "혈당 관리 완벽 가이드",
      link: "https://tistory.com/diabetes-guide",
      snippet: "혈당을 낮추는 방법에 대해 알아봅니다. 식단 조절, 운동, 약물 치료 등 다양한 방법을 소개합니다.",
      displayLink: "tistory.com"
    },
    {
      title: "당뇨 환자를 위한 식단표",
      link: "https://brunch.co.kr/@health/diabetes-food",
      snippet: "당뇨병 환자가 먹어도 되는 음식과 피해야 할 음식을 정리했습니다. 혈당 지수가 낮은 음식 위주로 섭취하세요.",
      displayLink: "brunch.co.kr"
    }
  ];

  // 검색어에 따라 다른 결과 반환
  await new Promise(resolve => setTimeout(resolve, 500)); // 실제 API처럼 딜레이
  
  return {
    items: mockResults.slice(0, num)
  };
}
